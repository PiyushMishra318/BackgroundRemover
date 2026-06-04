(function () {
  "use strict";

  function resolveApiUrl() {
    var path = window.location.pathname;
    var base = path;
    if (!base.endsWith("/")) {
      var last = base.split("/").pop();
      if (last && last.indexOf(".") >= 0) {
        base = base.slice(0, base.lastIndexOf("/") + 1);
      } else {
        base = base + "/";
      }
    }
    if (base === "/") return "/api/cutout";
    return base + "api/cutout";
  }

  function resolveApi() {
    return resolveApiUrl();
  }

  function assetUrl(path) {
    return new URL(path, window.location.href).href;
  }

  var SAMPLE = assetUrl("assets/sample.jpg");
  var MAX_FILE_BYTES = 10 * 1024 * 1024;

  var root = document.getElementById("workbench");
  if (!root) return;

  var dropzone = root.querySelector(".workbench__dropzone");
  var fileInput = root.querySelector("#demo-file");
  var panels = root.querySelector(".workbench__panels");
  var beforeImg = root.querySelector(".workbench__img--before");
  var afterImg = root.querySelector(".workbench__img--after");
  var placeholder = root.querySelector("#demo-placeholder");
  var thresholdInput = root.querySelector("#demo-threshold");
  var thresholdValue = root.querySelector("#demo-threshold-value");
  var meterFill = root.querySelector("#demo-meter-fill");
  var meterCutoff = root.querySelector("#demo-meter-cutoff");
  var cmdEl = root.querySelector("#workbench-cmd");
  var invertInput = root.querySelector("#demo-invert");
  var processBtn = root.querySelector("#demo-process");
  var downloadBtn = root.querySelector("#demo-download");
  var statusEl = root.querySelector("#demo-status");
  var filenameEl = root.querySelector("#demo-filename");
  var useSampleBtn = root.querySelector("#demo-sample");

  var state = {
    sourceUrl: null,
    sourceFile: null,
    sourceName: "sample.jpg",
    resultBlob: null,
    busy: false,
    objectUrls: [],
  };

  function revokeAll() {
    state.objectUrls.forEach(function (u) {
      URL.revokeObjectURL(u);
    });
    state.objectUrls = [];
  }

  function revokeTracked(keep) {
    var next = [];
    state.objectUrls.forEach(function (u) {
      if (keep && u === keep) {
        next.push(u);
        return;
      }
      URL.revokeObjectURL(u);
    });
    state.objectUrls = next;
  }

  function trackUrl(url) {
    if (state.objectUrls.indexOf(url) < 0) state.objectUrls.push(url);
    return url;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function setPanelState(mode) {
    panels.dataset.state = mode;
    root.dataset.hasResult = mode === "done" || mode === "signal" ? "true" : "false";
  }

  function thresholdPct() {
    return (parseInt(thresholdInput.value, 10) / 255) * 100;
  }

  function syncThresholdUi() {
    var t = thresholdInput.value;
    var pct = thresholdPct();
    thresholdValue.textContent = t;
    thresholdValue.value = t;
    thresholdInput.setAttribute("aria-valuenow", t);
    if (meterFill) meterFill.style.width = pct + "%";
    if (meterCutoff) meterCutoff.style.left = pct + "%";
    panels.style.setProperty("--threshold-pct", pct + "%");
    updateCli();
  }

  function updateCli() {
    if (!cmdEl) return;
    var name = state.sourceName || "input.jpg";
    var t = thresholdInput.value;
    var inv = invertInput.checked ? " --invert" : "";
    cmdEl.textContent =
      "bg-cutout-py -i " + name + " -o cutout.png -t " + t + inv;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImageUrl(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(url);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function applySource(url, label) {
    if (url && url.startsWith("blob:")) {
      revokeTracked(url);
      trackUrl(url);
    } else {
      revokeAll();
    }
    state.sourceUrl = url;
    state.sourceName = label || "input.jpg";
    state.resultBlob = null;
    beforeImg.src = url;
    afterImg.removeAttribute("src");
    afterImg.hidden = true;
    if (placeholder) placeholder.hidden = false;
    downloadBtn.disabled = true;
    setPanelState("idle");
    if (filenameEl) filenameEl.textContent = state.sourceName;
    updateCli();
    setStatus("Set threshold, then run cutout.");
  }

  function fileToBase64(dataUrl) {
    var comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  async function fetchCutout(base64, threshold, invert) {
    var res = await fetch(resolveApi(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64,
        threshold: threshold,
        invert: invert,
      }),
    });
    var ctype = (res.headers.get("Content-Type") || "").toLowerCase();
    var bodyText = await res.text();
    if (!ctype.includes("application/json")) {
      throw new Error(
        res.ok
          ? "Unexpected server response."
          : "Cutout service unavailable — try again or use the CLI."
      );
    }
    var data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseErr) {
      throw new Error("Invalid response from cutout service.");
    }
    if (!res.ok) {
      throw new Error(data.error || "Server error");
    }
    var bin = atob(data.png);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  function delay(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  async function runProcess() {
    if (state.busy || !state.sourceUrl) return;
    state.busy = true;
    processBtn.disabled = true;
    fileInput.disabled = true;
    setPanelState("matting");
    setStatus("cv.cvtColor → cv.threshold → BGRA…");

    try {
      var dataUrl;
      if (state.sourceFile) {
        dataUrl = await readFileAsDataUrl(state.sourceFile);
      } else if (
        state.sourceUrl.startsWith("blob:") ||
        state.sourceUrl.startsWith("data:")
      ) {
        dataUrl = state.sourceUrl;
      } else {
        var fetched = await fetch(state.sourceUrl);
        var blob = await fetched.blob();
        dataUrl = await readFileAsDataUrl(blob);
      }
      var threshold = parseInt(thresholdInput.value, 10);
      var invert = invertInput.checked;

      var minAnim = delay(1200);
      var cutout = fetchCutout(fileToBase64(dataUrl), threshold, invert);
      var results = await Promise.all([minAnim, cutout]);
      var resultBlob = results[1];

      state.resultBlob = resultBlob;
      var resultUrl = trackUrl(URL.createObjectURL(resultBlob));
      afterImg.src = resultUrl;
      afterImg.hidden = false;
      if (placeholder) placeholder.hidden = true;

      setPanelState("signal");
      setStatus("Mask locked — download BGRA or tweak threshold and re-run.");
      await delay(700);
      setPanelState("done");
      downloadBtn.disabled = false;
    } catch (err) {
      setPanelState("idle");
      setStatus(err.message || "Processing failed. Try a smaller image.");
    } finally {
      state.busy = false;
      processBtn.disabled = !state.sourceUrl;
      fileInput.disabled = false;
    }
  }

  function onFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus("Image must be under 10 MB.");
      return;
    }
    state.sourceFile = file;
    applySource(URL.createObjectURL(file), file.name);
  }

  function onDrop(e) {
    e.preventDefault();
    dropzone.classList.remove("workbench__dropzone--hover");
    var file = e.dataTransfer && e.dataTransfer.files[0];
    onFile(file);
  }

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("workbench__dropzone--hover");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("workbench__dropzone--hover");
  });
  dropzone.addEventListener("drop", onDrop);

  dropzone.addEventListener("click", function (e) {
    if (e.target === fileInput || e.target.closest("button")) return;
    fileInput.click();
  });

  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) onFile(fileInput.files[0]);
  });

  thresholdInput.addEventListener("input", syncThresholdUi);
  thresholdInput.addEventListener("change", function () {
    if (state.resultBlob) setStatus("Threshold changed — run cutout again.");
  });

  invertInput.addEventListener("change", function () {
    syncThresholdUi();
    if (state.resultBlob) setStatus("Invert toggled — run cutout again.");
  });

  processBtn.addEventListener("click", runProcess);

  downloadBtn.addEventListener("click", function () {
    if (!state.resultBlob) return;
    var a = document.createElement("a");
    a.href = trackUrl(URL.createObjectURL(state.resultBlob));
    a.download = "cutout.png";
    a.click();
  });

  useSampleBtn.addEventListener("click", function () {
    state.sourceFile = null;
    applySource(SAMPLE, "sample.jpg");
    loadImageUrl(SAMPLE).catch(function () {
      setStatus("Could not load sample image.");
    });
  });

  syncThresholdUi();
  applySource(SAMPLE, "sample.jpg");
  loadImageUrl(SAMPLE).then(function () {
    setStatus("Sample loaded — adjust threshold and run cutout.");
  });
})();
