$(function () {
    var $livePlay = $('#livePlay');
    var $pdfBox = $('#pdfBox');
    var $pdfCon = $('#pdfCon');
    var $fullscreen = $('#pdfFullscreen');
    var $winH = $(window).height();
    var curId = new Date().getTime();
    $pdfBox.show().siblings().hide();
    $pdfCon.find('canvas').remove();
    $pdfCon.append('<canvas id="pdfCanvas_' + curId + '"></canvas>');

    var pdfUrl = '/data/' + document.title;
    var pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null;
    var pdfH = $winH - 54 * 2; //减去上下留白高度
    var pdfW = parseInt(pdfH * 16 / 9); //按16：9比例计算
    var screenFull = undefined;
    var liveMediaProvider = undefined;
    var liveStream = undefined;

    /*初始化显示*/
    $('.spinner').show();
    $('#pdfPrev, #pdfNext').hide();
    $('#crtPdfPage, #totalPdfPage').text('-');

    PDFJS.disableWorker = true; //fix firefox load worker bug

    $(document).unbind('keydown').bind('keydown', function (event) {
        //判断当event.keyCode 为37时（即左方面键）
        //判断当event.keyCode 为39时（即右方面键）
        if (event.keyCode == 37) {
            onPrevPage();
        } else if (event.keyCode == 39) {
            onNextPage();
        }
    });

    $livePlay.on('click', function() {
        var _this = $(this);
        if (_this.hasClass('icon-bofang1')) {
            if (!liveMediaProvider) {
                startRecording(function (result) {
                    if (result.ret) {
                        liveStream = result.content;
                        _this.removeClass('icon-bofang1').addClass('icon-bofang').parent().attr('data-tooltips', '直播结束');
                    } else {
                        alert(result.content);
                    }
                    liveMediaProvider = undefined;
                });
            }
        } else {
            if (liveStream) stopRecording(liveStream.recorder);
            liveStream = undefined;
            _this.removeClass('icon-bofang').addClass('icon-bofang1').parent().attr('data-tooltips', '开始直播');
        }
    });

    // 全屏
    window.onload = function() {
        var hookApis = [
            [ 'requestFullscreen', 'exitFullscreen', 'fullscreenchange', 'fullscreen', 'fullscreenElement' ],
            [ 'webkitRequestFullScreen', 'webkitCancelFullScreen', 'webkitfullscreenchange', 'webkitIsFullScreen', 'webkitCurrentFullScreenElement' ],
            [ 'mozRequestFullScreen', 'mozCancelFullScreen', 'mozfullscreenchange', 'mozFullScreen', 'mozFullScreenElement' ],
            [ 'msRequestFullScreen', 'msCancelFullScreen', 'msfullscreenchange', 'msFullScreen', 'msFullscreenElement' ]
        ];
        return screenFull = {
            init: function () {
                for (var index = 0; index < hookApis.length; index++) {
                    hookApi = hookApis[index];
                    if (hookApi[0] in document.documentElement && hookApi[1] in document) {
                        this.api = hookApi;
                        break;
                    }
                }
                return this.api ? this : undefined;
            },
            isModeOn: function () {
                var isOn = window.fullScreen || document.fullscreen || document.webkitFullScreen || document.webkitIsFullScreen || document.mozFullScreen || document.msFullScreen;
                console.log('isFullScreen: ' + isOn);
                return isOn;
            },
            request: function () {
                document.documentElement && (this.isModeOn() || document.documentElement[this.api[0]]());
            },
            exit: function () {
                document[this.api[1]]();
            },
            toggle: function () {
                this.isModeOn() ? this.exit() : this.request();
            },
            onchange: function () {}
        }.init();
    };

    $fullscreen.on('click', function () {
        var _this = $(this);
        if (_this.hasClass('icon-fullscreen-exit')) {
            screenFull && screenFull.exit();
            $pdfCon.css({
                'left': '50%',
                'top': '50%',
                '-webkit-transform': 'translate(-50%,-50%)',
                '-ms-transform': 'translate(-50%,-50%)',
                '-o-transform': 'translate(-50%,-50%)',
                '-moz-transform': 'translate(-50%,-50%)',
                'transform': 'translate(-50%,-50%)'
            });
        } else {
            screenFull && screenFull.request();
        }
    });

    // 退出全屏
    window.onresize = function () {
        if (!screenFull) return;
        if (screenFull.isModeOn()) {
            if ($fullscreen.hasClass('icon-quanping')) {
                $fullscreen.removeClass('icon-quanping').addClass('icon-fullscreen-exit').parent().attr('data-tooltips', '退出全屏');
            }
        } else {
            if ($fullscreen.hasClass('icon-fullscreen-exit')) {
                $fullscreen.removeClass('icon-fullscreen-exit').addClass('icon-quanping').parent().attr('data-tooltips', '全屏浏览');
            }
        }
    };

    /**
     * Get page info from document, resize canvas accordingly, and render page.
     * @param num Page number.
     */
    function renderPage(num) {
        pageRendering = true;
        // Using promise to fetch the page
        pdfDoc.getPage(num).then(function (page) {
            var canvas = document.getElementById('pdfCanvas_' + curId);
            var ctx = canvas.getContext('2d');

            //按宽高比例缩放
            var viewport = page.getViewport(1);
            var scale = pdfH / viewport.height;
            var scaledViewport = page.getViewport(scale);

            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            // Render PDF page into canvas context
            var renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
            };

            var renderTask = page.render(renderContext);
            // Wait for rendering to finish
            renderTask.promise.then(function () {
                pageRendering = false;
                if (pageNumPending !== null) {
                    // New page rendering is pending
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
                $('.spinner').hide();
                $('#pdfPrev,#pdfNext').show();
            });
            $('#pdfCon').animate({
                'width': pdfW,
                'height': pdfH
            }, 500);
        }, function (reason) {
            // PDF loading error
            console.error(reason);
        });

        // Update page counters
        document.getElementById('crtPdfPage').textContent = pageNum;
        document.getElementById('pdfPrev').addEventListener('click', onPrevPage);
        document.getElementById('pdfNext').addEventListener('click', onNextPage);
    }

    /**
     * If another page rendering in progress, waits until the rendering is
     * finised. Otherwise, executes rendering immediately.
     */
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    /**
     * Displays previous page.
     */
    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }

    /**
     * Displays next page.
     */
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }

    function startRecording(callback) {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        liveMediaProvider = navigator.getUserMedia;
        if (navigator.getUserMedia) {
            navigator.getUserMedia( { audio: true }, function (stream) {
                var AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
                var context = new AudioContext();
                var config = { sampleBits: 8, sampleRate: context.sampleRate };
                var audioInput = context.createMediaStreamSource(stream);
                var createScript = context.createScriptProcessor || context.createJavaScriptNode;
                var audioStream = {
                    recorder: createScript.apply(context, [4096, 1, 1]),
                    size: 0, buffer: [],
                    inputSampleRate: context.sampleRate, inputSampleBits: 16,
                    outputSampleRate: config.sampleRate, oututSampleBits: config.sampleBits,
                    input: function (data) {
                        this.buffer.push(new Float32Array(data));
                        this.size += data.length;
                    }, compress: function () {
                        var data = new Float32Array(this.size);
                        var offset = 0;
                        for (var i = 0; i < this.buffer.length; i++) {
                            data.set(this.buffer[i], offset);
                            offset += this.buffer[i].length;
                        }
                        var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
                        var length = data.length / compression;
                        var result = new Float32Array(length);
                        var index = 0, j = 0;
                        while (index < length) {
                            result[index] = data[j];
                            j += compression;
                            index++;
                        }
                        return result;
                    }, encode: function () {
                        var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
                        var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
                        var bytes = this.compress();
                        var dataLength = bytes.length * (sampleBits / 8);
                        var buffer = new ArrayBuffer(44 + dataLength);
                        var data = new DataView(buffer);
                        var channelCount = 1;//单声道
                        var offset = 0;
                        var writeString = function (str) {
                            for (var i = 0; i < str.length; i++) {
                                data.setUint8(offset + i, str.charCodeAt(i));
                            }
                        }

                        writeString('RIFF'); offset += 4;
                        data.setUint32(offset, 36 + dataLength, true); offset += 4;
                        writeString('WAVE'); offset += 4;
                        writeString('fmt '); offset += 4;
                        data.setUint32(offset, 16, true); offset += 4;
                        data.setUint16(offset, 1, true); offset += 2;
                        data.setUint16(offset, channelCount, true); offset += 2;
                        data.setUint32(offset, sampleRate, true); offset += 4;
                        data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
                        data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
                        data.setUint16(offset, sampleBits, true); offset += 2;
                        writeString('data'); offset += 4;
                        data.setUint32(offset, dataLength, true); offset += 4;
                        if (sampleBits === 8) {
                            for (var i = 0; i < bytes.length; i++ , offset++) {
                                var s = Math.max(-1, Math.min(1, bytes[i]));
                                var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                                val = parseInt(255 / (65535 / (val + 32768)));
                                data.setInt8(offset, val, true);
                            }
                        } else {
                            for (var i = 0; i < bytes.length; i++ , offset += 2) {
                                var s = Math.max(-1, Math.min(1, bytes[i]));
                                data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                            }
                        }
                        return new Blob([data], { type: 'audio/mp3' });
                    }
                };
                audioStream.recorder.onaudioprocess = function (src) {
                    audioStream.input(src.inputBuffer.getChannelData(0));
                };

                audioInput.connect(audioStream.recorder);
                audioStream.recorder.connect(context.destination);

                callback( { ret: true, content: audioStream } );
            }, function (error) {
                switch (error.code || error.name) {
                    case 'NotAllowedError':
                    case 'PERMISSION_DENIED':
                    case 'PermissionDeniedError':
                        callback( { ret: false, content: '请勿拒绝我们申请录音权限，否则无法直播录音！' } );
                        break;
                    case 'NOT_SUPPORTED_ERROR':
                    case 'NotSupportedError':
                        callback( { ret: false, content: '未找到录音支持设备，请检查您的系统麦克风！' } );
                        break;
                    case 'MANDATORY_UNSATISFIED_ERROR':
                    case 'MandatoryUnsatisfiedError':
                        callback( { ret: false, content: '当前设备不满足录音条件，请检查您的系统麦克风！' } );
                        break;
                    default:
                        callback( { ret: false, content: '打开麦克风异常，错误信息：' + (error.code || error.name) } );
                        break;
                }
            } );
        } else {
            callback( { ret: false, content: '当前浏览器不支持直播录音！请换用其它浏览器尝试！' } );
        }
    }

    function stopRecording(recorder) {
        recorder.disconnect();
    }

    /**
     * Asynchronously downloads PDF.
     */
    PDFJS.getDocument(pdfUrl).then(function (pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('totalPdfPage').textContent = pdfDoc.numPages;
        // Initial/first page rendering
        renderPage(pageNum);
    });
});