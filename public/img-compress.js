// Shrinks big photos in the browser before upload: max 1600px, WebP ~82%. SVG/GIF and small files pass through.
window.vhCompressImage = function (file) {
  return new Promise(function (resolve) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || (file.size < 250 * 1024)) return resolve(file);
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var MAX = 1600, w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) { var r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(function (blob) {
        if (!blob || blob.size >= file.size) return resolve(file);
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }));
      }, 'image/webp', 0.82);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};
