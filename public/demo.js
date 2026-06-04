(function () {
  "use strict";

  var API = "/api/cutout";
  var SAMPLE = "assets/sample.jpg";
  var DEFAULT_THRESHOLD = 100;
  var MAX_FILE_BYTES = 10 * 1024 * 1024;

  var root = document.getElementById("try-it");
  if (!root) return;

  var dropzone = root.querySelector(".demo__dropzone");
  var fileInput = root.querySelector("#demo-file");
  var stage = root.querySelector(".demo__stage");
  var beforeImg = root.querySelector(".demo__img--before");
  var afterImg = root.querySelector(".demo__img--after");
  var compareRange = root.querySelector("#demo-compare");
  var thresholdInput = root.querySelector("#demo-threshold");
  var thresholdValue = root.querySelector("#demo-threshold-value");
  var invertInput = root.querySelector("#demo-invert");
  var processBtn = root.querySelector("#demo-process");
  var downloadBtn = root.querySelector("#demo-download");
  var statusEl = root.querySelector(".demo__status");
  var filenameEl = root.querySelector(".demo__filename");
  var useSampleBtn = root.querySelector("#demo-sample");

  var state = {
    sourceUrl: null,
    sourceFile: null,
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

  function trackUrl(url) {
    state.objectUrls.push(url);
    return url;
  }

  function setStatus(msg, live) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    if (live) statusEl.setAttribute("aria-live", "polite");
  }

  function setStageMode(mode) {
    stage.dataset.state = mode;
    root.dataset.hasResult = mode === "done" || mode === "reveal" ? "true" : "false";
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
    revokeAll();
    state.sourceUrl = url;
    state.resultBlob = null;
    beforeImg.src = url;
    afterImg.removeAttribute("src");
    afterImg.hidden = true;
    downloadBtn.disabled = true;
    compareRange.disabled = true;
    compareRange.value = "50";
    stage.style.setProperty("--compare", "50%");
    setStageMode("idle");
    if (filenameEl) filenameEl.textContent = label || "Image loaded";
    setStatus("Adjust threshold, then cut out the background.", true);
  }

  function fileToBase64(dataUrl) {
    var comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  async function fetchCutout(base64, threshold, invert) {
    var res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64,
        threshold: threshold,
        invert: invert,
      }),
    });
    var data = await res.json();
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
    setStageMode("processing");
    setStatus("Thresholding grayscale and building alpha mask…", true);

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

      var minAnim = delay(1400);
      var cutout = fetchCutout(fileToBase64(dataUrl), threshold, invert);
      var results = await Promise.all([minAnim, cutout]);
      var blob = results[1];

      state.resultBlob = blob;
      var resultUrl = trackUrl(URL.createObjectURL(blob));
      afterImg.src = resultUrl;
      afterImg.hidden = false;
      root.querySelector(".demo__layer--after").removeAttribute("aria-hidden");

      setStageMode("reveal");
      setStatus("Reveal complete — drag the slider to compare.", true);
      await delay(900);
      setStageMode("done");
      downloadBtn.disabled = false;
      compareRange.disabled = false;
    } catch (err) {
      setStageMode("idle");
      setStatus(err.message || "Processing failed. Try again or use a smaller image.", true);
    } finally {
      state.busy = false;
      processBtn.disabled = !state.sourceUrl;
      fileInput.disabled = false;
    }
  }

  function onFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("Please choose a JPEG or PNG image.", true);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus("Image must be under 10 MB.", true);
      return;
    }
    state.sourceFile = file;
    var url = trackUrl(URL.createObjectURL(file));
    applySource(url, file.name);
  }

  function onDrop(e) {
    e.preventDefault();
    dropzone.classList.remove("demo__dropzone--hover");
    var file = e.dataTransfer && e.dataTransfer.files[0];
    onFile(file);
  }

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("demo__dropzone--hover");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("demo__dropzone--hover");
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

  thresholdInput.addEventListener("input", function () {
    thresholdValue.textContent = thresholdInput.value;
  });

  compareRange.addEventListener("input", function () {
    var v = compareRange.value;
    stage.style.setProperty("--compare", v + "%");
    compareRange.setAttribute("aria-valuenow", v);
  });

  processBtn.addEventListener("click", runProcess);
  invertInput.addEventListener("change", function () {
    if (state.resultBlob) setStatus("Settings changed — run cutout again.", true);
  });
  thresholdInput.addEventListener("change", function () {
    if (state.resultBlob) setStatus("Threshold changed — run cutout again.", true);
  });

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
      setStatus("Could not load sample image.", true);
    });
  });

  thresholdValue.textContent = thresholdInput.value;
  applySource(SAMPLE, "sample.jpg");
  loadImageUrl(SAMPLE).then(function () {
    setStatus("Sample loaded — tweak threshold and cut out.", true);
  });
})();
