(function () {
  "use strict";

  var app = document.getElementById("app");
  var params = new URLSearchParams(window.location.search);
  var screen = params.get("screen");
  var selectedAssetId = params.get("asset");
  var selectedTeaId = params.get("tea");

  fetch("/assets/tea-visuals/manifest.json")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Manifest HTTP " + response.status);
      }
      return response.json();
    })
    .then(function (manifest) {
      var model = indexManifest(manifest);
      if (screen) {
        document.body.classList.add("capture");
        renderCapture(model);
      } else {
        renderBoard(model);
      }
    })
    .catch(function (error) {
      app.innerHTML = '<p class="error">无法读取 Manifest：' + escapeHtml(error.message) + "</p>";
    });

  function indexManifest(manifest) {
    var teas = {};
    var assets = {};
    manifest.teas.forEach(function (tea) {
      teas[tea.tea_id] = tea;
      tea.assets.forEach(function (asset) {
        assets[asset.id] = { tea: tea, asset: asset };
      });
    });
    return { manifest: manifest, teas: teas, assets: assets };
  }

  function renderCapture(model) {
    if (screen === "blind") {
      var indexedAsset = model.assets[selectedAssetId];
      if (!indexedAsset) {
        throw new Error("未知 Asset ID：" + selectedAssetId);
      }
      app.innerHTML = blindScreen(indexedAsset.tea, indexedAsset.asset);
      return;
    }

    var tea = model.teas[selectedTeaId || "duyun-maojian"];
    if (!tea) {
      throw new Error("未知 Tea ID：" + selectedTeaId);
    }

    if (screen === "reveal") {
      app.innerHTML = revealScreen(tea);
      return;
    }
    if (screen === "detail") {
      app.innerHTML = detailScreen(tea);
      return;
    }
    if (screen === "passport") {
      app.innerHTML = passportScreen(tea);
      return;
    }

    throw new Error("未知 Screen：" + screen);
  }

  function renderBoard(model) {
    var tiles = [];
    var sequenceTiles = [];
    model.manifest.teas.forEach(function (tea) {
      tea.assets.forEach(function (asset) {
        tiles.push(reviewTile(
          "?screen=blind&asset=" + encodeURIComponent(asset.id),
          tea.name + " · Blind " + asset.variant.toUpperCase()
        ));
      });
      sequenceTiles.push(reviewTile(
        "?screen=blind&asset=" + encodeURIComponent(tea.visual_profile.primary_anchor_asset_id),
        tea.name + " · 主锚点"
      ));
    });
    tiles.push(reviewTile("?screen=reveal&tea=duyun-maojian", "都匀毛尖 · Reveal"));
    tiles.push(reviewTile("?screen=detail&tea=duyun-maojian", "都匀毛尖 · Detail"));
    tiles.push(reviewTile("?screen=passport&tea=duyun-maojian", "都匀毛尖 · Passport"));

    app.innerHTML = [
      '<section class="review-board">',
      '<header class="review-header">',
      "<div>",
      "<h1>Tea Visual Review</h1>",
      "<p>6 张 Blind 基底 + 都匀毛尖跨状态继承。所有文字与抽象层均由 DOM/CSS 渲染。</p>",
      "</div>",
      '<div class="review-legend">',
      "<span>synthetic_demo</span>",
      "<span>demo_only</span>",
      "<span>390 × 844</span>",
      "</div>",
      "</header>",
      '<section class="review-mode">',
      '<div class="review-mode-heading"><div><h2>连续三卡模式</h2><p>同屏检查三种视觉人格是否只是在换颜色，以及连续浏览是否出现模板疲劳。</p></div><span>3 teas · primary anchors</span></div>',
      '<div class="review-sequence">',
      sequenceTiles.join(""),
      "</div>",
      "</section>",
      '<section class="review-mode">',
      '<div class="review-mode-heading"><div><h2>单卡模式</h2><p>逐张检查 Blind 风险、真实茶锚点、跨状态继承与 Passport 缩略图。</p></div><span>9 states</span></div>',
      '<div class="review-grid">',
      tiles.join(""),
      "</div>",
      "</section>",
      "</section>"
    ].join("");
  }

  function reviewTile(src, label) {
    return [
      '<figure class="review-item">',
      '<iframe loading="lazy" title="' + escapeHtml(label) + '" src="' + src + '"></iframe>',
      "<figcaption>" + escapeHtml(label) + "</figcaption>",
      "</figure>"
    ].join("");
  }

  function blindScreen(tea, asset) {
    var profile = tea.visual_profile;
    return [
      '<section class="screen-shell">',
      headerHtml("2 / 6"),
      '<article class="tea-card tea--' + escapeHtml(tea.tea_id) + '" style="' + profileStyle(profile) + '">',
      mediaHtml(asset),
      atmosphereHtml(profile),
      '<div class="card-wash"></div>',
      shapeHtml(profile),
      '<div class="card-copy">',
      "<h1>" + escapeHtml(asset.card_copy.headline) + "</h1>",
      "<p>" + escapeHtml(asset.card_copy.body) + "</p>",
      tagsHtml(asset.card_copy.tags),
      "</div>",
      '<footer class="card-footer">',
      '<p class="scene">“' + escapeHtml(asset.card_copy.scene) + '”</p>',
      '<div class="actions">',
      '<button class="action" type="button">下一杯</button>',
      '<button class="action action--primary" type="button">想喝</button>',
      "</div>",
      "</footer>",
      "</article>",
      navHtml("刷茶"),
      "</section>"
    ].join("");
  }

  function revealScreen(tea) {
    var profile = tea.visual_profile;
    var asset = tea.assets[0];
    var supports = tea.evidence_refs[0].supports;
    return [
      '<section class="screen-shell">',
      headerHtml("Reveal"),
      '<article class="tea-card reveal-card tea--' + escapeHtml(tea.tea_id) + '" style="' + profileStyle(profile) + '">',
      mediaHtml(asset),
      atmosphereHtml(profile),
      '<div class="card-wash"></div>',
      shapeHtml(profile),
      '<div class="reveal-panel">',
      '<p class="eyebrow">你刚刚喜欢的是</p>',
      "<h1>" + escapeHtml(tea.name) + "</h1>",
      '<p class="region">' + escapeHtml(tea.region) + "</p>",
      tagsHtml(supports.slice(0, 3)),
      '<p class="translation">你刚才说的“清、嫩、尾巴有点甜”，在茶的语言里，大概接近嫩香、鲜爽与回甘。</p>',
      '<div class="reveal-actions">',
      '<button class="action" type="button">继续刷</button>',
      '<button class="action action--primary" type="button">看看这杯</button>',
      "</div>",
      "</div>",
      "</article>",
      navHtml("刷茶"),
      "</section>"
    ].join("");
  }

  function detailScreen(tea) {
    var asset = tea.assets[1];
    return [
      '<section class="screen-shell detail-page">',
      '<button class="detail-back" type="button" aria-label="返回">←</button>',
      '<div class="detail-hero">',
      mediaHtml(asset),
      '<div class="detail-identity">',
      '<h1 class="detail-title">' + escapeHtml(tea.name) + "</h1>",
      '<p class="region">' + escapeHtml(tea.region) + "</p>",
      "</div>",
      "</div>",
      '<div class="detail-body">',
      '<div class="detail-tags"><span>鲜爽</span><span>栗香</span><span>回甘</span></div>',
      '<div class="detail-actions">',
      '<button class="detail-action" type="button"><span>🫖</span><strong>泡这杯</strong><small>AI 在旁边看着你泡。</small></button>',
      '<button class="detail-action" type="button"><span>🍵</span><strong>品这杯</strong><small>不会形容也没关系。</small></button>',
      "</div>",
      '<button class="origin-action" type="button"><span><strong>看看它从哪里来</strong><span>进入这片叶子背后的贵州。</span></span><b>→</b></button>',
      "</div>",
      navHtml("刷茶"),
      "</section>"
    ].join("");
  }

  function passportScreen(tea) {
    var derivative = tea.assets[0].derivatives[0];
    return [
      '<section class="screen-shell">',
      '<header class="app-header"><span class="wordmark">茶护照</span><span class="progress">1 杯</span></header>',
      '<article class="passport-card">',
      '<img src="/' + escapeHtml(derivative.path) + '" alt="">',
      '<div class="passport-copy">',
      "<h1>" + escapeHtml(tea.name) + "</h1>",
      '<p class="region">' + escapeHtml(tea.region) + "</p>",
      "<p>“像雨后的嫩草，第二泡更甜。”</p>",
      tagsHtml(["已泡", "已品", "已解锁茶境"]),
      "</div>",
      "</article>",
      navHtml("我的"),
      "</section>"
    ].join("");
  }

  function headerHtml(progress) {
    return [
      '<header class="app-header">',
      '<span class="wordmark">Tea-BTI</span>',
      '<span class="progress">' + escapeHtml(progress) + "</span>",
      '<span class="help">？</span>',
      "</header>"
    ].join("");
  }

  function navHtml(active) {
    return [
      '<nav class="bottom-nav" aria-label="主导航">',
      navItem("刷茶", active),
      navItem("茶境", active),
      navItem("我的", active),
      "</nav>"
    ].join("");
  }

  function navItem(label, active) {
    var activeClass = label === active ? " nav-item--active" : "";
    return '<span class="nav-item' + activeClass + '"><i class="nav-dot"></i>' + label + "</span>";
  }

  function mediaHtml(asset) {
    return '<img class="media" src="/' + escapeHtml(asset.media_path) + '" style="object-position:' +
      escapeHtml(asset.crop_strategy.object_position) + '" alt="">';
  }

  function atmosphereHtml(profile) {
    return '<div class="atmosphere atmosphere--' + escapeHtml(profile.atmosphere_cue) + '"></div>';
  }

  function shapeHtml(profile) {
    if (profile.abstract_form === "rounded_low_mass") {
      return '<div class="shape shape--rounded_low_mass"></div>';
    }
    if (profile.abstract_form === "layered_horizontal") {
      return [
        '<div class="shape shape--layered_horizontal">',
        '<svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">',
        '<path d="M2 9 C24 1 38 16 60 8 C74 3 86 5 98 1" fill="none" stroke="currentColor" stroke-width="2.1"/>',
        '<path d="M1 19 C18 12 35 27 54 17 C70 9 86 20 99 12" fill="none" stroke="currentColor" stroke-width="2.1"/>',
        '<path d="M4 31 C26 21 43 35 64 27 C79 21 89 25 98 21" fill="none" stroke="currentColor" stroke-width="2.1"/>',
        "</svg>",
        "</div>"
      ].join("");
    }
    return [
      '<div class="shape shape--ridge_line">',
      '<svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">',
      '<path d="M0 35 C13 29 22 12 35 20 C48 28 57 4 70 14 C84 24 96 11 120 5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
      "</svg>",
      "</div>"
    ].join("");
  }

  function tagsHtml(tags) {
    return '<div class="tags">' + tags.map(function (tag) {
      return '<span class="tag">' + escapeHtml(tag) + "</span>";
    }).join("") + "</div>";
  }

  function profileStyle(profile) {
    var overlay = profile.overlay;
    return [
      "--structure-color:" + profile.structure_color,
      "--shape-bottom:" + overlay.bottom_percent + "%",
      "--shape-left:" + overlay.left_percent + "%",
      "--shape-width:" + overlay.width_percent + "%",
      "--shape-height:" + overlay.height_percent + "%",
      "--shape-opacity:" + overlay.opacity,
      "--atmosphere-opacity:" + overlay.atmosphere_opacity
    ].join(";");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}());
