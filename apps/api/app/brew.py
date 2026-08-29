from __future__ import annotations

import math
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import catalog
from .models import BrewEvent, BrewInfusion, BrewRun, utcnow
from .taste import record_drink_feedback


BREW_STAGES = ("prepare", "warm_vessel", "add_leaves", "pour", "steep", "decant", "taste", "complete")
VISION_EVENTS = ("leaves_present", "water_pouring", "decanting", "occluded", "none")
FEEDBACK_TYPES = ("too_light", "balanced", "too_strong", "bitter", "astringent", "too_hot", "too_cool", "other")
STAGE_TRANSITIONS = {
    "prepare": "warm_vessel",
    "warm_vessel": "add_leaves",
    "add_leaves": "pour",
    "pour": "steep",
    "steep": "decant",
    "decant": "taste",
}
VISION_TARGETS = {
    ("add_leaves", "leaves_present"): "pour",
    ("pour", "water_pouring"): "steep",
    ("steep", "decanting"): "decant",
}


class BrewError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _first_int(value: str, fallback: int) -> int:
    match = re.search(r"\d+", value or "")
    return int(match.group()) if match else fallback


def _temperature_midpoint(value: str) -> int | None:
    numbers = [int(item) for item in re.findall(r"\d+", value or "")]
    if not numbers:
        return None
    return round(sum(numbers[:2]) / min(2, len(numbers)))


def vessel_kind(vessel: str) -> str:
    if "茶碗" in vessel or "茶筅" in vessel:
        return "matcha"
    if "玻璃" in vessel:
        return "glass"
    return "gaiwan"


def duration_schedule(tea_id: str, vessel: str, guide: dict[str, Any]) -> list[int]:
    kind = vessel_kind(vessel)
    if kind == "matcha":
        return [20]
    if tea_id == "leishan-yinqiu" and kind == "glass":
        return [90, 90, 120]
    if tea_id == "lvbaoshi" and kind == "gaiwan":
        return [20, 25, 35]
    if guide.get("steepTime"):
        midpoint = _temperature_midpoint(str(guide["steepTime"])) or 15
        return [midpoint, midpoint + 5, midpoint + 10]
    if kind == "glass":
        return [60, 60, 75]
    return [15, 20, 25]


def create_brew_run(
    db: Session,
    *,
    voice_session_id: str,
    user_id: str,
    tea_id: str,
    camera_enabled: bool,
    vessel: str | None = None,
    water_volume_ml: int | None = None,
) -> BrewRun:
    tea = catalog.require_tea(tea_id)
    guide = tea["brewingGuide"]
    selected_vessel = vessel or guide["vessel"].split("或")[0]
    selected_water = water_volume_ml or _first_int(guide["waterVolume"], 150)
    is_matcha = vessel_kind(selected_vessel) == "matcha"
    run = BrewRun(
        id=str(uuid.uuid4()),
        voice_session_id=voice_session_id,
        user_id=user_id,
        tea_id=tea_id,
        vessel=selected_vessel,
        temperature_c=_temperature_midpoint(guide["temperatureRange"]),
        temperature_range=guide["temperatureRange"],
        tea_amount=guide["teaAmount"],
        water_volume_ml=selected_water,
        max_infusions=1 if is_matcha else 3,
        camera_enabled=camera_enabled and not is_matcha,
        current_stage="add_leaves" if is_matcha else "prepare",
    )
    db.add(run)
    db.flush()
    schedule = duration_schedule(tea_id, selected_vessel, guide)
    for number, seconds in enumerate(schedule[: run.max_infusions], start=1):
        db.add(BrewInfusion(
            id=str(uuid.uuid4()),
            brew_run_id=run.id,
            number=number,
            planned_temperature_c=run.temperature_c,
            planned_duration_seconds=seconds,
        ))
    db.flush()
    return run


def require_brew_run(db: Session, voice_session_id: str, user_id: str) -> BrewRun:
    run = db.scalar(select(BrewRun).where(
        BrewRun.voice_session_id == voice_session_id,
        BrewRun.user_id == user_id,
    ))
    if run is None:
        raise BrewError("BREW_RUN_NOT_FOUND", "陪泡记录不存在")
    return run


def current_infusion(db: Session, run: BrewRun) -> BrewInfusion:
    infusion = db.scalar(select(BrewInfusion).where(
        BrewInfusion.brew_run_id == run.id,
        BrewInfusion.number == run.current_infusion,
    ))
    if infusion is None:
        raise BrewError("BREW_INFUSION_NOT_FOUND", "当前泡数不存在")
    return infusion


def brew_state_response(db: Session, run: BrewRun) -> dict[str, Any]:
    infusion = current_infusion(db, run)
    now = utcnow()
    deadline = _as_utc(run.deadline_at)
    remaining = max(0, math.ceil((deadline - now).total_seconds())) if deadline else None
    completed = db.scalars(select(BrewInfusion).where(
        BrewInfusion.brew_run_id == run.id,
        BrewInfusion.completed_at.is_not(None),
    ).order_by(BrewInfusion.number)).all()
    return {
        "runId": run.id,
        "status": run.status,
        "teaId": run.tea_id,
        "vessel": run.vessel,
        "temperatureC": infusion.planned_temperature_c,
        "temperatureRange": run.temperature_range,
        "teaAmount": run.tea_amount,
        "waterVolumeMl": run.water_volume_ml,
        "currentStage": run.current_stage,
        "infusionNumber": run.current_infusion,
        "maxInfusions": run.max_infusions,
        "plannedDurationSeconds": infusion.planned_duration_seconds,
        "timerStartedAt": run.timer_started_at,
        "deadlineAt": run.deadline_at,
        "remainingSeconds": remaining,
        "pendingVisionEvent": run.pending_vision_event,
        "cameraEnabled": run.camera_enabled,
        "isMatcha": run.max_infusions == 1,
        "adjustmentMessage": run.adjustment_message,
        "completedInfusions": [infusion_response(item) for item in completed],
    }


def infusion_response(infusion: BrewInfusion) -> dict[str, Any]:
    return {
        "number": infusion.number,
        "plannedTemperatureC": infusion.planned_temperature_c,
        "plannedDurationSeconds": infusion.planned_duration_seconds,
        "actualDurationSeconds": infusion.actual_duration_seconds,
        "feedback": infusion.feedback,
        "userWords": infusion.user_words,
        "adjustmentType": infusion.adjustment_type,
        "adjustmentValue": infusion.adjustment_value,
        "adjustmentReason": infusion.adjustment_reason,
    }


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _finish_timer(run: BrewRun, infusion: BrewInfusion) -> None:
    started = _as_utc(run.timer_started_at)
    if started:
        infusion.actual_duration_seconds = max(0, round((utcnow() - started).total_seconds()))
    run.timer_started_at = None
    run.deadline_at = None


def _apply_stage(run: BrewRun, infusion: BrewInfusion, target: str) -> str:
    if target == run.current_stage:
        return f"当前仍在{target}阶段。"
    expected = STAGE_TRANSITIONS.get(run.current_stage)
    if target != expected:
        raise BrewError("BREW_STAGE_TRANSITION", f"不能从 {run.current_stage} 直接进入 {target}")
    run.current_stage = target
    run.pending_vision_event = None
    if target == "steep":
        now = utcnow()
        run.timer_started_at = now
        run.deadline_at = now + timedelta(seconds=infusion.planned_duration_seconds)
        infusion.started_at = now
        return f"用户确认已注水，第 {run.current_infusion} 泡开始计时 {infusion.planned_duration_seconds} 秒。"
    if target == "decant":
        _finish_timer(run, infusion)
        return "用户确认现在出汤；如果使用玻璃杯，则表示现在可以品饮。"
    return f"用户确认进入 {target} 阶段。"


def _feedback_adjustment(run: BrewRun, infusion: BrewInfusion, feedback: str) -> str:
    if run.current_infusion >= run.max_infusions:
        return "三泡已经完成，这次反馈已记下。"
    kind = vessel_kind(run.vessel)
    step = 10 if kind == "glass" else 5
    if feedback == "too_light":
        infusion.adjustment_type = "duration"
        infusion.adjustment_value = step
        infusion.adjustment_reason = "这一泡偏淡"
        return f"你刚才觉得有点淡，下一泡我们多等 {step} 秒。"
    if feedback in {"too_strong", "bitter", "astringent"}:
        infusion.adjustment_type = "duration"
        infusion.adjustment_value = -step
        infusion.adjustment_reason = "这一泡偏浓、偏苦或偏涩"
        feeling = {"too_strong": "浓", "bitter": "苦", "astringent": "涩"}[feedback]
        return f"你刚才觉得有点{feeling}，下一泡我们少等 {step} 秒。"
    if feedback == "too_hot":
        infusion.adjustment_type = "temperature"
        infusion.adjustment_value = -5
        infusion.adjustment_reason = "这一泡入口偏烫"
        return "你刚才觉得有点烫，下一泡水温往下收 5°C。"
    if feedback == "too_cool":
        infusion.adjustment_type = "temperature"
        infusion.adjustment_value = 5
        infusion.adjustment_reason = "这一泡温度偏低"
        return "你刚才觉得温度不够，下一泡水温往上提 5°C。"
    infusion.adjustment_type = None
    infusion.adjustment_value = None
    infusion.adjustment_reason = "保持下一泡原定参数"
    return "这一泡先记下，下一泡沿用原来的节奏。"


def apply_brew_event(
    db: Session,
    run: BrewRun,
    *,
    client_event_id: str,
    event_type: str,
    source: str,
    stage: str | None = None,
    seconds: int | None = None,
    feedback: str | None = None,
    user_words: str | None = None,
) -> tuple[bool, str]:
    existing = db.scalar(select(BrewEvent).where(
        BrewEvent.brew_run_id == run.id,
        BrewEvent.client_event_id == client_event_id,
    ))
    if existing:
        return False, "这个动作已经记下。"
    if run.status != "active" and event_type != "complete":
        raise BrewError("BREW_RUN_STATE", "这次陪泡已经结束")
    infusion = current_infusion(db, run)
    message = "动作已记下。"
    payload: dict[str, Any] = {}
    if event_type == "confirm_stage":
        if not stage or stage not in BREW_STAGES:
            raise BrewError("BREW_STAGE_REQUIRED", "缺少有效阶段")
        if source == "camera_confirmed":
            expected = VISION_TARGETS.get((run.current_stage, run.pending_vision_event))
            if expected != stage:
                raise BrewError("VISION_CONFIRMATION_STALE", "这个画面候选已经失效，请重新确认当前动作")
        message = _apply_stage(run, infusion, stage)
        payload["stage"] = stage
    elif event_type == "decline_vision":
        run.pending_vision_event = None
        message = "视觉提示已忽略，继续等待你的确认。"
    elif event_type == "timer_adjust":
        if run.current_stage != "steep" or not run.deadline_at or not seconds:
            raise BrewError("BREW_TIMER_STATE", "当前没有可调整的计时")
        if seconds < -300 or seconds > 300:
            raise BrewError("BREW_TIMER_RANGE", "单次调整不能超过 300 秒")
        run.deadline_at = _as_utc(run.deadline_at) + timedelta(seconds=seconds)
        infusion.planned_duration_seconds = max(5, infusion.planned_duration_seconds + seconds)
        message = f"计时已{'延长' if seconds > 0 else '缩短'} {abs(seconds)} 秒。"
        payload["seconds"] = seconds
    elif event_type == "taste_feedback":
        if run.current_stage != "taste" or feedback not in FEEDBACK_TYPES:
            raise BrewError("BREW_FEEDBACK_STATE", "请在品饮阶段提供有效反馈")
        infusion.feedback = feedback
        infusion.user_words = user_words
        infusion.completed_at = utcnow()
        message = _feedback_adjustment(run, infusion, feedback)
        run.adjustment_message = message
        result = "like" if feedback == "balanced" else "neutral"
        tags = ["astringent"] if feedback in {"bitter", "astringent"} else []
        record_drink_feedback(db, run.user_id, run.tea_id, result, user_words, run.current_infusion, tags)
        payload.update({"feedback": feedback, "userWords": user_words})
    elif event_type == "next_infusion":
        if run.current_stage != "taste" or infusion.feedback is None:
            raise BrewError("BREW_NEXT_INFUSION_STATE", "先说说这一泡，再进入下一泡")
        if run.current_infusion >= run.max_infusions:
            raise BrewError("BREW_MAX_INFUSIONS", "已经到最后一泡")
        next_item = db.scalar(select(BrewInfusion).where(
            BrewInfusion.brew_run_id == run.id,
            BrewInfusion.number == run.current_infusion + 1,
        ))
        if next_item is None:
            raise BrewError("BREW_INFUSION_NOT_FOUND", "下一泡不存在")
        if infusion.adjustment_type == "duration" and infusion.adjustment_value:
            next_item.planned_duration_seconds = max(5, next_item.planned_duration_seconds + infusion.adjustment_value)
        elif infusion.adjustment_type == "temperature" and infusion.adjustment_value:
            minimums = [int(item) for item in re.findall(r"\d+", run.temperature_range)]
            low, high = (minimums[0], minimums[1]) if len(minimums) >= 2 else (70, 95)
            base = next_item.planned_temperature_c or run.temperature_c or 85
            next_item.planned_temperature_c = min(high, max(low, base + infusion.adjustment_value))
        run.current_infusion += 1
        run.current_stage = "pour"
        run.timer_started_at = None
        run.deadline_at = None
        run.pending_vision_event = None
        message = f"现在是第 {run.current_infusion} 泡，准备好就注水。{run.adjustment_message or ''}"
    elif event_type == "complete":
        _finish_timer(run, infusion)
        run.current_stage = "complete"
        run.status = "completed"
        run.completed_at = utcnow()
        message = "这次陪泡已经完成。"
    else:
        raise BrewError("BREW_EVENT_TYPE", "不支持的陪泡动作")
    db.add(BrewEvent(
        id=str(uuid.uuid4()),
        brew_run_id=run.id,
        client_event_id=client_event_id,
        event_type=event_type,
        source=source,
        payload=payload,
    ))
    db.flush()
    return True, message


def register_vision_observation(db: Session, run: BrewRun, event: str) -> tuple[bool, str | None, str | None]:
    if event not in VISION_EVENTS:
        raise BrewError("VISION_EVENT_INVALID", "视觉结果不在允许范围内")
    now = utcnow()
    cooldown = _as_utc(run.vision_cooldown_until)
    if cooldown and cooldown > now:
        return False, None, None
    target = VISION_TARGETS.get((run.current_stage, event))
    if not target:
        run.vision_streak_event = None
        run.vision_streak_count = 0
        return False, None, None
    if run.vision_streak_event == event:
        run.vision_streak_count += 1
    else:
        run.vision_streak_event = event
        run.vision_streak_count = 1
    if run.vision_streak_count < 2:
        return False, None, None
    run.pending_vision_event = event
    run.vision_streak_event = None
    run.vision_streak_count = 0
    run.vision_cooldown_until = now + timedelta(seconds=8)
    labels = {
        "leaves_present": "我看到像是已经投茶，要进入注水吗？",
        "water_pouring": "我看到像是已经注水，要现在开始计时吗？",
        "decanting": "我看到像是在出汤，要结束这一泡的计时吗？",
    }
    return True, target, labels[event]


def classify_voice_intent(text: str, run: BrewRun) -> dict[str, Any] | None:
    value = text.strip().lower()
    if any(word in value for word in ("结束陪泡", "不泡了", "结束泡茶")):
        return {"eventType": "complete"}
    if any(word in value for word in ("延长五秒", "多五秒", "再等五秒")):
        return {"eventType": "timer_adjust", "seconds": 5}
    if any(word in value for word in ("现在出汤", "提前出汤", "可以出汤")) and run.current_stage == "steep":
        return {"eventType": "confirm_stage", "stage": "decant"}
    feedback_words = [
        ("too_hot", ("太烫", "有点烫", "水温太高")),
        ("too_cool", ("太凉", "有点凉", "水温不够")),
        ("astringent", ("太涩", "有点涩", "涩")),
        ("bitter", ("太苦", "有点苦", "苦")),
        ("too_strong", ("太浓", "太重", "味道重")),
        ("too_light", ("太淡", "没味", "味道淡")),
        ("balanced", ("正好", "刚刚好", "很合适", "好喝")),
    ]
    if run.current_stage == "taste":
        for feedback, words in feedback_words:
            if any(word in value for word in words):
                return {"eventType": "taste_feedback", "feedback": feedback, "userWords": text}
    if any(word in value for word in ("对", "是的", "开始", "好了", "下一步")):
        if run.pending_vision_event:
            target = VISION_TARGETS.get((run.current_stage, run.pending_vision_event))
            if target:
                return {"eventType": "confirm_stage", "stage": target}
        target = STAGE_TRANSITIONS.get(run.current_stage)
        if target:
            return {"eventType": "confirm_stage", "stage": target}
    if any(word in value for word in ("不是", "没有", "还没", "看错了")) and run.pending_vision_event:
        return {"eventType": "decline_vision"}
    return None


def brew_voice_reply(text: str, run: BrewRun, infusion: BrewInfusion) -> str | None:
    value = text.strip().lower()
    if any(word in value for word in ("还有多久", "还剩多久", "剩几秒")):
        deadline = _as_utc(run.deadline_at)
        if run.current_stage != "steep" or deadline is None:
            return "现在还没有开始浸泡计时。"
        seconds = max(0, math.ceil((deadline - utcnow()).total_seconds()))
        return f"这一泡还剩大约 {seconds} 秒。"
    if any(word in value for word in ("重复一下", "再说一遍", "刚才说什么")):
        instructions = {
            "prepare": "先确认器具和水量，准备好后告诉我。",
            "warm_vessel": "先温一下器具，完成后告诉我。",
            "add_leaves": "现在投茶；如果是抹茶，现在加入茶粉。",
            "pour": "准备好就注水，确认后我会开始计时。",
            "steep": f"这一泡原计划等 {infusion.planned_duration_seconds} 秒。",
            "decant": "现在出汤；玻璃杯可以直接开始品饮。",
            "taste": "喝一口，告诉我是淡、正好、浓、苦、涩、烫，还是凉。",
            "complete": "这次陪泡已经完成。",
        }
        return instructions[run.current_stage]
    if "暂停听我说" in value or value == "暂停":
        return "好，我先暂停聆听；现实中的浸泡计时会继续。"
    if value in {"继续", "继续听", "继续吧"}:
        return "好，我们继续。"
    return None
