$(function () {
    var $livePlay = $('#livePlay');
    var $pdfBox = $('#pdfBox');
    var $pdfCon = $('#pdfCon');
    var $fullscreen = $('#pdfFullscreen');
    var $winH = $(window).height();
    var randomId = generateMixed(4);
    $pdfBox.show().siblings().hide();
    $pdfCon.find('canvas').remove();
    $pdfCon.append('<canvas id="pdfCanvas_' + randomId + '"></canvas>');

    var pdfUrl = '/data/' + document.title;
    var pdfDoc = null,
        pageNum = 1,
        pageRendering = false,
        pageNumPending = null;
    var pdfH = $winH - 54 * 2; //减去上下留白高度
    var pdfW = parseInt(pdfH * 16 / 9); //按16：9比例计算
    var screenfull = undefined;

    /*初始化显示*/
    $('.spinner').show();
    $('#pdfPrev, #pdfNext').hide();
    $('#crtPdfPage, #totalPdfPage').text('-');

    PDFJS.disableWorker = true; //fix firefox load worker bug

    $(document).unbind("keydown").bind("keydown", function (event) {
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
            _this.removeClass('icon-bofang1').addClass('icon-bofang').parent().attr('data-tooltips', '直播结束');
        } else {
            _this.removeClass('icon-bofang').addClass('icon-bofang1').parent().attr('data-tooltips', '开始直播');
        }
    });

    // 全屏
    window.onload = function() {
        var hookApis = [
            [ "requestFullscreen", "exitFullscreen", "fullscreenchange", "fullscreen", "fullscreenElement" ],
            [ "webkitRequestFullScreen", "webkitCancelFullScreen", "webkitfullscreenchange", "webkitIsFullScreen", "webkitCurrentFullScreenElement" ],
            [ "mozRequestFullScreen", "mozCancelFullScreen", "mozfullscreenchange", "mozFullScreen", "mozFullScreenElement" ]
        ];
        return screenfull = {
            init: function () {
                console.log(document);
                for (var index = 0; index < hookApis.length; index++) {
                    hookApi = hookApis[index];
                    if (hookApi[0] in document.documentElement && hookApi[1] in document) {
                        this.api = hookApi;
                        break;
                    }
                }
                console.log(this.api);
                return this.api ? this : undefined;
            },
            request: function () {
                document.documentElement && (document[this.api[3]] || document.documentElement[this.api[0]]());
            },
            exit: function () {
                document[this.api[1]]();
            },
            toggle: function () {
                document[this.api[3]] ? this.exit() : this.request();
            },
            onchange: function () {}
        }.init();
    };

    $fullscreen.on('click', function () {
        var _this = $(this);
        if (_this.hasClass('icon-fullscreen-exit')) {
            screenfull && screenfull.exit();
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
            screenfull && screenfull.request();
        }
    });

    // 退出全屏
    window.onresize = function () {
        var isFull = checkFull();
        console.log('isFull: ' + isFull);
        if (isFull) {
            if ($fullscreen.hasClass('icon-quanping')) {
                $fullscreen.removeClass('icon-quanping').addClass('icon-fullscreen-exit').parent().attr('data-tooltips', '退出全屏');
            }
        } else {
            if ($fullscreen.hasClass('icon-fullscreen-exit')) {
                $fullscreen.removeClass('icon-fullscreen-exit').addClass('icon-quanping').parent().attr('data-tooltips', '全屏浏览');
            }
        }
    };

    // 判断是否为全屏
    function checkFull() {
        return window.fullScreen || document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen;
    }

    /**
     * Get page info from document, resize canvas accordingly, and render page.
     * @param num Page number.
     */
    function renderPage(num) {
        pageRendering = true;
        // Using promise to fetch the page
        pdfDoc.getPage(num).then(function (page) {
            var canvas = document.getElementById('pdfCanvas_' + randomId);
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

//生成随机数
function generateMixed(n) {
    var res = "";
    var chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    for (var i = 0; i < n; i++) {
        var id = Math.ceil(Math.random() * 35);
        res += chars[id];
    }
    return res;
}