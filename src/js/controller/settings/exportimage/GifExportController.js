(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  var URL_MAX_LENGTH = 30;
  var MAX_GIF_COLORS = 256;
  var MAGIC_PINK = '#FF00FF';
  var WHITE = '#FFFFFF';

  ns.GifExportController = function (piskelController, exportController) {
    this.piskelController = piskelController;
    this.exportController = exportController;
  };

  pskl.utils.inherit(ns.GifExportController, pskl.controller.settings.AbstractSettingController);

  ns.GifExportController.prototype.init = function () {
    this.uploadStatusContainerEl = document.querySelector('.gif-upload-status');
    this.downloadButton = document.querySelector('.gif-download-button');
    this.repeatCheckbox = document.querySelector('.gif-repeat-checkbox');

    // Initialize repeatCheckbox state
    this.repeatCheckbox.checked = this.getRepeatSetting_();

    this.addEventListener(this.downloadButton, 'click', this.onDownloadButtonClick_);
    this.addEventListener(this.repeatCheckbox, 'change', this.onRepeatCheckboxChange_);

    var currentColors = pskl.app.currentColorsService.getCurrentColors();
    var tooManyColors = currentColors.length >= MAX_GIF_COLORS;
    document.querySelector('.gif-export-warning').classList.toggle('visible', tooManyColors);
  };

  ns.GifExportController.prototype.getZoom_ = function () {
    return this.exportController.getExportZoom();
  };

  ns.GifExportController.prototype.onDownloadButtonClick_ = function (evt) {
    var zoom = this.getZoom_();
    var fps = this.piskelController.getFPS();

    this.renderAsImageDataAnimatedGIF(zoom, fps, this.downloadImageData_.bind(this));
  };

  ns.GifExportController.prototype.downloadImageData_ = function (imageData) {
    var fileName = this.piskelController.getPiskel().getDescriptor().name + '.gif';
    pskl.utils.BlobUtils.dataToBlob(imageData, 'image/gif', function(blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    });
  };

  ns.GifExportController.prototype.updatePreview_ = function (src) {
    this.previewContainerEl.innerHTML = '<div><img style="max-width:32px;" src="' + src + '"/></div>';
  };

  ns.GifExportController.prototype.renderAsImageDataAnimatedGIF = function(zoom, fps, cb) {
    var currentColors = pskl.app.currentColorsService.getCurrentColors();

    var layers = this.piskelController.getLayers();
    var isTransparent = layers.some(function (l) {return l.isTransparent();});
    var preserveColors = !isTransparent && currentColors.length < MAX_GIF_COLORS;

    var transparentColor;
    var transparent;
    // transparency only supported if preserveColors is true, see Issue #357
    if (preserveColors) {
      transparentColor = this.getTransparentColor(currentColors);
      transparent = parseInt(transparentColor.substring(1), 16);
    } else {
      transparentColor = WHITE;
      transparent = null;
    }

    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();

    var gif = new window.GIF({
      workers: 5,
      quality: 1,
      width: width * zoom,
      height: height * zoom,
      preserveColors : preserveColors,
      repeat: this.getRepeatSetting_() ? 0 : -1,
      transparent : transparent
    });

    // Create a background canvas that will be filled with the transparent color before each render.
    var background = pskl.utils.CanvasUtils.createCanvas(width, height);
    var context = background.getContext('2d');
    context.fillStyle = transparentColor;

    for (var i = 0 ; i < this.piskelController.getFrameCount() ; i++) {
      var render = this.piskelController.renderFrameAt(i, true);
      context.clearRect(0, 0, width, height);
      context.fillRect(0, 0, width, height);
      context.drawImage(render, 0, 0, width, height);

      var canvas = pskl.utils.ImageResizer.scale(background, zoom);
      gif.addFrame(canvas.getContext('2d'), {
        delay: 1000 / fps
      });
    }

    $.publish(Events.SHOW_PROGRESS, [{'name': 'Building animated GIF ...'}]);
    gif.on('progress', function(percentage) {
      $.publish(Events.UPDATE_PROGRESS, [{'progress': (percentage * 100).toFixed(1)}]);
    }.bind(this));

    gif.on('finished', function(blob) {
      $.publish(Events.HIDE_PROGRESS);
      pskl.utils.FileUtils.readFile(blob, cb);
    }.bind(this));

    gif.render();
  };

  ns.GifExportController.prototype.getTransparentColor = function(currentColors) {
    var transparentColor = pskl.utils.ColorUtils.getUnusedColor(currentColors);

    if (!transparentColor) {
      console.error('Unable to find unused color to use as transparent color in the current sprite');
      transparentColor = MAGIC_PINK;
    }

    return transparentColor;
  };

  ns.GifExportController.prototype.onRepeatCheckboxChange_ = function () {
    var checked = this.repeatCheckbox.checked;
    pskl.UserSettings.set(pskl.UserSettings.EXPORT_GIF_REPEAT, checked);
  };

  ns.GifExportController.prototype.getRepeatSetting_ = function () {
    return pskl.UserSettings.get(pskl.UserSettings.EXPORT_GIF_REPEAT);
  };
})();
