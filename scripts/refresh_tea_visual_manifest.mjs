#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "assets/tea-visuals/manifest.json");
const current = JSON.parse(readFileSync(manifestPath, "utf8"));
const previousByTea = new Map(current.teas.map((tea) => [tea.tea_id, tea]));

const teas = [
  {
    id: "duyun-maojian", name: "都匀毛尖", region: "贵州 · 黔南州 · 都匀市",
    presentationSource: "07-都匀毛尖-立体版.png",
    color: "#718A5A", form: "ridge_line", atmosphere: "morning_mist",
    headline: "山雾刚散。", body: "嫩叶的清气先到，回甘在后面轻轻跟上。", tags: ["灵动", "敏锐", "清醒"], scene: "晨雾刚从黔南山间散开",
    detailSource: "assets/tea-visuals/masters/detail/source/duyun-maojian.jpg", detailPosition: "50% 50%",
    photoUrl: "https://www.pp918.com/guideinfo_9521.html",
  },
  {
    id: "meitan-cuiya", name: "湄潭翠芽", region: "贵州 · 遵义市 · 湄潭县",
    presentationSource: "08-湄潭翠芽-立体版.png",
    color: "#56784B", form: "layered_horizontal", atmosphere: "spring_afternoon",
    headline: "清香落得很轻。", body: "扁平嫩叶安静铺开，清香在杯口多停了一会儿。", tags: ["克制", "细致", "有秩序"], scene: "春日下午，留一点空白",
    detailSource: "assets/tea-visuals/masters/detail/edited/meitan-cuiya-watermark-removed-v1.png", detailPosition: "50% 48%",
    photoUrl: "https://nynct.guizhou.gov.cn/syqt/tsny/202512/t20251202_89008101.html",
    detailOriginal: "assets/tea-visuals/masters/detail/source/meitan-cuiya.png",
    editNote: "OpenAI image editor removed only the bottom-right public-account watermark; the original source file is retained alongside this version.",
    editChain: [{
      operation: "watermark_removal", tool: "OpenAI ImageGen (image-2)", version: "v1",
      scope: { x: 870, y: 740, width: 210, height: 84 },
      constraints: "Remove only the bottom-right public-account watermark; preserve tea leaves, liquor, vessels, background, color and composition.",
      verification: { original_dimensions_preserved: true, outside_scope_pixel_difference: "0 (0)" },
    }],
  },
  {
    id: "lvbaoshi", name: "绿宝石茶", region: "贵州 · 高原茶区",
    presentationSource: "06-绿宝石茶-立体版.png",
    color: "#315D4D", form: "rounded_low_mass", atmosphere: "spring_afternoon",
    headline: "一颗，慢慢展开。", body: "紧实的颗粒落进水里，鲜爽和回甘一层层松开。", tags: ["沉稳", "凝聚", "有韧性"], scene: "事情很多，也想稳稳喝一杯",
    detailSource: "assets/tea-visuals/masters/detail/source/lvbaoshi.jpg", detailPosition: "50% 48%",
    photoUrl: "https://www.chabaike.com/lvcha/lvbaoshicha/",
  },
  {
    id: "puan-hong", name: "普安红", region: "贵州 · 黔西南州 · 普安县",
    presentationSource: "04-普安红-立体版.png",
    color: "#82543E", form: "ridge_line", atmosphere: "dusk_table",
    headline: "暖意慢慢回来。", body: "蜜香和花果香先靠近，甘润留在最后。", tags: ["温暖", "深沉", "有包容力"], scene: "天色转暖，留一盏慢慢喝",
    detailSource: "assets/tea-visuals/masters/detail/source/puan-hong.jpg", detailPosition: "66% 50%",
    photoUrl: "https://www.tesegu.com/techan/54874.html",
  },
  {
    id: "fenggang-xinxi", name: "凤冈锌硒茶", region: "贵州 · 遵义市 · 凤冈县",
    presentationSource: "05-凤冈锌硒茶-立体版.png",
    color: "#55745D", form: "layered_horizontal", atmosphere: "morning_mist",
    headline: "山里有自己的平衡。", body: "自然的清香铺开，鲜爽和醇厚没有争先。", tags: ["自然", "平衡", "可靠"], scene: "需要把节奏放稳的时候",
    detailSource: "assets/tea-visuals/masters/detail/source/fenggang-xinxi.jpg", detailPosition: "50% 55%",
    photoUrl: "https://www.chinateawholesale.com/product-page/fenggang-zinc-selenium-organic-tea-gui-zhou-green-tea-wholesale-1",
  },
  {
    id: "zunyi-hong", name: "遵义红", region: "贵州 · 遵义茶区",
    presentationSource: "01-遵义红-立体版.png",
    color: "#8B4032", form: "ridge_line", atmosphere: "dusk_table",
    headline: "暖意沿着山脉流动。", body: "嫩甜香很快抵达，鲜爽醇厚把这一杯稳稳接住。", tags: ["热烈", "坚定", "有行动力"], scene: "想把一件事认真做成",
    detailSource: "assets/tea-visuals/masters/detail/source/zunyi-hong.jpg", detailPosition: "58% 50%",
    photoUrl: "https://www.ebuy7.com/2023-guizhou-zunyi-black-tea-meitan-fenggang-alpine-cloud-tea-bulk-bag-fruity-flavor-bulk-250g.html",
  },
  {
    id: "leishan-yinqiu", name: "雷山银球茶", region: "贵州 · 黔东南州 · 雷山县",
    presentationSource: "03-雷山银球茶-立体版.png",
    color: "#466B5C", form: "rounded_low_mass", atmosphere: "morning_mist",
    headline: "一颗茶球，慢慢打开。", body: "不急着说完，清香和回甘随着叶片层层展开。", tags: ["内敛", "慢热", "层层展开"], scene: "给一杯茶多一点时间",
    detailSource: "assets/tea-visuals/masters/detail/source/leishan-yinqiu.png", detailPosition: "50% 56%",
    photoUrl: "https://www.nfncb.cn/yaowen/45539.html",
  },
  {
    id: "fanjingshan-matcha", name: "梵净山抹茶", region: "贵州 · 铜仁市 · 梵净山周边",
    presentationSource: "02-梵净山抹茶-立体版.png",
    color: "#42653B", form: "ridge_line", atmosphere: "spring_afternoon",
    headline: "青意在山巅醒来。", body: "鲜明的植物清香和细腻茶汤，把注意力拉回此刻。", tags: ["专注", "鲜明", "充满能量"], scene: "需要迅速进入状态",
    detailSource: "assets/tea-visuals/masters/detail/edited/fanjingshan-matcha-watermark-removed-v1.png", detailPosition: "50% 50%",
    photoUrl: "https://www.thepaper.cn/newsDetail_forward_25908717",
    detailOriginal: "assets/tea-visuals/masters/detail/source/fanjingshan-matcha.jpg",
    editNote: "OpenAI image editor removed only the bottom-right media/account watermark; the original source file is retained alongside this version.",
    editChain: [{
      operation: "watermark_removal", tool: "OpenAI ImageGen (image-2)", version: "v1",
      scope: { x: 720, y: 560, width: 480, height: 88 },
      constraints: "Remove only the bottom-right media/account watermark; preserve matcha, liquor, vessels, background, color and composition.",
      verification: { original_dimensions_preserved: true, outside_scope_pixel_difference: "0 (0)" },
    }],
  },
];

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(root, relativePath))).digest("hex");
}

function dimensions(relativePath) {
  const output = execFileSync("magick", ["identify", "-format", "%w %h", resolve(root, relativePath)], { encoding: "utf8" });
  const [width, height] = output.trim().split(/\s+/).map(Number);
  return { width, height };
}

function assetDimensions(masterPath, mediaPath) {
  const master = dimensions(masterPath);
  const media = dimensions(mediaPath);
  return { master_width: master.width, master_height: master.height, media_width: media.width, media_height: media.height };
}

const manifest = {
  $schema: "./manifest.schema.json",
  schema_version: 3,
  visual_grammar_version: "0.2",
  generated_at: new Date().toISOString(),
  review_viewport: { width: 390, height: 844 },
  teas: teas.map((tea) => {
    const presentationMaster = `assets/tea-visuals/masters/presentation/${tea.id}.png`;
    const presentationMedia = `assets/tea-visuals/media/presentation/${tea.id}.webp`;
    const detailMedia = `assets/tea-visuals/media/detail/${tea.id}.webp`;
    const previous = previousByTea.get(tea.id);
    const legacyAssets = previous?.legacy_assets ?? previous?.assets?.filter((asset) => !asset.active) ?? [];
    const presentation = {
      id: `${tea.id}-presentation`, role: "presentation", active: true,
      source_kind: "user_provided", authenticity_state: "stylized_demo", rights_state: "demo_only",
      rights_note: "User-provided stylized Tea-BTI artwork for non-commercial demonstration; public or commercial reuse requires rights confirmation.",
      source_url: `attachment:立体化贵州茶设计图/${tea.presentationSource}`,
      master_path: presentationMaster, media_path: presentationMedia,
      ...assetDimensions(presentationMaster, presentationMedia),
      crop_strategy: { aspect_ratio: "9:16", object_position: "50% 50%" },
      master_sha256: sha256(presentationMaster), sha256: sha256(presentationMedia),
      card_copy: { headline: tea.headline, body: tea.body, tags: tea.tags, scene: tea.scene },
    };
    const detail = {
      id: `${tea.id}-detail`, role: "detail", source_kind: "third_party_photo",
      authenticity_state: "reference", rights_state: "unknown",
      rights_note: "Provided for non-commercial demo and design reference. Removing a watermark does not grant publication or commercial rights.",
      source_url: tea.photoUrl, credit: "Source page recorded in the supplied photo provenance file.",
      original_path: tea.detailOriginal ?? tea.detailSource,
      master_path: tea.detailSource, media_path: detailMedia,
      ...assetDimensions(tea.detailSource, detailMedia),
      original_sha256: sha256(tea.detailOriginal ?? tea.detailSource), master_sha256: sha256(tea.detailSource),
      object_position: tea.detailPosition, sha256: sha256(detailMedia), edit_note: tea.editNote ?? null,
      edit_chain: tea.editChain ?? [],
    };
    return {
      tea_id: tea.id, name: tea.name, region: tea.region,
      visual_profile: {
        primary_anchor_asset_id: presentation.id,
        anchor_types: ["stylized_identity"], structure_color: tea.color,
        structure_color_basis: "Taken from the supplied dimensional Guizhou tea artwork.",
        abstract_form: tea.form, abstract_form_basis: "Supports the supplied dimensional paper-art composition.",
        atmosphere_cue: tea.atmosphere, atmosphere_is_metaphor: true,
        overlay: { bottom_percent: 0, left_percent: 0, width_percent: 100, height_percent: 100, opacity: 0, atmosphere_opacity: 0 },
      },
      assets: [presentation], legacy_assets: legacyAssets.map((asset) => ({ ...asset, active: false })),
      detail_asset: detail, realm_assets: previous?.realm_assets ?? [],
    };
  }),
  review_exports: current.review_exports ?? [],
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
