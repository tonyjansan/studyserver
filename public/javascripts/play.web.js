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

    //全屏
    $fullscreen.on('click', function () {
        var _this = $(this);
        if (_this.hasClass('isFull')) {
            _this.removeClass("isFull icon-quanping").addClass('icon-fullscreen-exit').parent().attr('data-tooltips', '退出全屏');
            screenfull && screenfull.request();
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
            screenfull && screenfull.exit();
        }
    });

    // 退出全屏
    window.onresize = function () {
        if (!checkFull()) {
            $fullscreen.removeClass("icon-fullscreen-exit").addClass('isFull icon-quanping').parent().attr('data-tooltips', '全屏浏览');
        }
    };

    // 判断是否为全屏
    function checkFull() {
        var isFull = document.fullscreenEnabled || window.fullScreen || document.webkitIsFullScreen || document.msFullscreenEnabled;
        if (isFull === undefined) isFull = false;
        return isFull;
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

//全屏
(function (a, b) {
    "use strict";
    var c = function () {
        var a = [
            ["requestFullscreen", "exitFullscreen", "fullscreenchange", "fullscreen", "fullscreenElement"],
            ["webkitRequestFullScreen", "webkitCancelFullScreen", "webkitfullscreenchange", "webkitIsFullScreen", "webkitCurrentFullScreenElement"],
            ["mozRequestFullScreen", "mozCancelFullScreen", "mozfullscreenchange", "mozFullScreen", "mozFullScreenElement"]
        ];
        for (var c = 0,
            d = a.length; c < d; c++) {
            var e = a[c];
            if (e[1] in b) return e
        }
    }();
    if (!c) return a.screenfull = !1;
    var d = "ALLOW_KEYBOARD_INPUT" in Element,
        e = {
            init: function () {
                return b.addEventListener(c[2],
                    function (a) {
                        e.isFullscreen = b[c[3]],
                            e.element = b[c[4]],
                            e.onchange(a)
                    }),
                    this
            },
            isFullscreen: b[c[3]],
            element: b[c[4]],
            request: function (a) {

                a = a || b.documentElement,
                    a[c[0]](d && Element.ALLOW_KEYBOARD_INPUT),
                    b.isFullscreen || a[c[0]]();
            },
            exit: function () {
                b[c[1]]()
            },
            toggle: function (a) {
                this.isFullscreen ? this.exit() : this.request(a)
            },
            onchange: function () { }
        };
    a.screenfull = e.init()
})(window, document);