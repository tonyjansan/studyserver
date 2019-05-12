var liveControl = {
    mediaProvider: undefined,
    audioInput: undefined,
    audioRecorder: undefined,
    startRecording: function(callback) {
        if (liveControl.mediaProvider) return; // in progress, do nothing!
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        liveControl.mediaProvider = navigator.getUserMedia;
        if (navigator.getUserMedia) {
            navigator.getUserMedia( { audio: true }, function (stream) {
                var AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
                var context = new AudioContext();
                var config = { sampleBits: 8, sampleRate: context.sampleRate };
                var createScript = context.createScriptProcessor || context.createJavaScriptNode;
                liveControl.audioInput = context.createMediaStreamSource(stream);
                var audioStream = {
                    size: 0, buffer: [],
                    inputSampleRate: context.sampleRate, inputSampleBits: 16,
                    outputSampleRate: config.sampleRate, oututSampleBits: config.sampleBits,
                    input: function (data) {
                        this.buffer.push(new Float32Array(data));
                        this.size += data.length;
                        console.log(data.length);
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
                liveControl.audioRecorder = createScript.apply(context, [4096, 1, 1]);
                liveControl.audioRecorder.onaudioprocess = function (src) {
                    audioStream.input(src.inputBuffer.getChannelData(0));
                };
                liveControl.audioInput.connect(liveControl.audioRecorder);
                liveControl.audioRecorder.connect(context.destination);
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
    },
    stopRecording: function() {
        if (!liveControl.audioInput || !liveControl.audioRecorder) return;
        liveControl.audioInput.disconnect();
        liveControl.audioInput = undefined;
        liveControl.audioRecorder.disconnect();
        liveControl.audioRecorder = undefined;
    },
    reset: function() {
        liveControl.mediaProvider = undefined;
    }
};