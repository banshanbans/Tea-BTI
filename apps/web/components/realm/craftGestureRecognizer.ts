export type GesturePoint = { x: number; y: number; time: number };
export type GestureRecognition = { matched: boolean; score: number };

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function recognizeTiltAlternations(values: number[]): GestureRecognition {
  let previous: -1 | 0 | 1 = 0;
  let alternations = 0;
  for (const value of values) {
    const side: -1 | 0 | 1 = value >= 6 ? 1 : value <= -6 ? -1 : 0;
    if (!side) continue;
    if (previous && side !== previous) alternations += 1;
    previous = side;
  }
  return { matched: alternations >= 3, score: clampScore(55 + alternations * 10) };
}

export function recognizeForwardPush(points: GesturePoint[], width: number, height: number): GestureRecognition {
  if (points.length < 2) return { matched: false, score: 0 };
  const start = points[0];
  const end = points[points.length - 1];
  const forward = start.y - end.y;
  const drift = Math.abs(end.x - start.x);
  const matched = forward >= height * 0.3 && drift <= width * 0.4;
  return { matched, score: matched ? clampScore(65 + forward / height * 50 - drift / width * 20) : 0 };
}

export function recognizeRolling(points: GesturePoint[], width: number, height: number): GestureRecognition {
  if (points.length < 5) return { matched: false, score: 0 };
  let previousDirection = 0;
  let reversals = 0;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const direction = Math.abs(dx) >= width * 0.025 ? Math.sign(dx) : 0;
    if (direction && previousDirection && direction !== previousDirection) reversals += 1;
    if (direction) previousDirection = direction;
    minX = Math.min(minX, points[index].x); maxX = Math.max(maxX, points[index].x);
    minY = Math.min(minY, points[index].y); maxY = Math.max(maxY, points[index].y);
  }
  const span = maxX - minX;
  const drift = maxY - minY;
  const matched = reversals >= 3 && span >= width * 0.25 && drift <= height * 0.45;
  return { matched, score: matched ? clampScore(58 + reversals * 7 + span / width * 15 - drift / height * 10) : 0 };
}

export function recognizeCircle(points: GesturePoint[], width: number, height: number): GestureRecognition {
  if (points.length < 8) return { matched: false, score: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const boxWidth = Math.max(...xs) - Math.min(...xs);
  const boxHeight = Math.max(...ys) - Math.min(...ys);
  if (boxWidth < width * 0.2 || boxHeight < height * 0.2) return { matched: false, score: 0 };
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
  let turn = 0;
  let previous = Math.atan2(points[0].y - centerY, points[0].x - centerX);
  let pathLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const angle = Math.atan2(points[index].y - centerY, points[index].x - centerX);
    let delta = angle - previous;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    turn += delta;
    pathLength += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    previous = angle;
  }
  const aspect = boxWidth / boxHeight;
  const closure = Math.hypot(points.at(-1)!.x - points[0].x, points.at(-1)!.y - points[0].y);
  const diagonal = Math.hypot(boxWidth, boxHeight);
  const degrees = Math.abs(turn) * 180 / Math.PI;
  const matched = pathLength >= 90 && degrees >= 260 && aspect >= 0.45 && aspect <= 2.2 && closure <= diagonal * 0.45;
  return { matched, score: matched ? clampScore(55 + Math.min(25, (degrees - 300) / 4) + (1 - closure / diagonal) * 20) : 0 };
}

function reversals(values: number[], threshold: number): number {
  let previous = 0;
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const direction = Math.abs(delta) >= threshold ? Math.sign(delta) : 0;
    if (direction && previous && direction !== previous) count += 1;
    if (direction) previous = direction;
  }
  return count;
}

export function recognizePekoeMulti(first: GesturePoint[], second: GesturePoint[], width: number): GestureRecognition {
  const count = Math.min(first.length, second.length);
  if (count < 5) return { matched: false, score: 0 };
  const duration = Math.min(first.at(-1)!.time, second.at(-1)!.time) - Math.max(first[0].time, second[0].time);
  const relative = Array.from({ length: count }, (_, index) => first[index].x - second[index].x);
  const centroids = Array.from({ length: count }, (_, index) => (first[index].x + second[index].x) / 2);
  const centroidDrift = Math.max(...centroids) - Math.min(...centroids);
  const reverseCount = reversals(relative, width * 0.018);
  const matched = duration >= 350 && centroidDrift <= width * 0.35 && reverseCount >= 2;
  return { matched, score: matched ? clampScore(58 + reverseCount * 9 - centroidDrift / width * 20) : 0 };
}

export function recognizePekoeSingle(points: GesturePoint[], height: number): GestureRecognition {
  if (points.length < 5) return { matched: false, score: 0 };
  const ys = points.map((point) => point.y);
  const span = Math.max(...ys) - Math.min(...ys);
  const reverseCount = reversals(ys, height * 0.018);
  const matched = reverseCount >= 3 && span >= height * 0.08 && span <= height * 0.35;
  return { matched, score: matched ? clampScore(55 + reverseCount * 8) : 0 };
}
