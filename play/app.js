(function () {
  
  var getUserMedia;
  (function () {
    getUserMedia = function getUserMedia() {
      return (navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia) || false;  
    };
  }())
  
  var getAudioCtx;
  (function () {
    var contexts = [];
    getAudioCtx = function getAudioCtx(key) {
      return (typeof key !== 'undefined') && contexts[key] || new (window.AudioContext || window.webkitAudioContext)();
    };
  }());
  
  var audioCtx = getAudioCtx('main');
  var voiceSelect = document.getElementById("voice");
  var source;
  var stream;
  
  // grab the mute button to use below
  
  var mute = document.querySelector('.mute');
  
  //set up the different audio nodes we will use for the app
  
  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;
  
  var distortion = audioCtx.createWaveShaper();
  var gainNode = audioCtx.createGain();
  var biquadFilter = audioCtx.createBiquadFilter();
  var freqOutput = document.querySelector('.freq');
  
  // distortion curve for the waveshaper, thanks to Kevin Ennis
  // http://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion
  
  function makeDistortionCurve(amount) {
    var k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for ( ; i < n_samples; ++i ) {
      x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
  };
  
  var soundSource, concertHallBuffer;
  
  // set up canvas context for visualizer
  
  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");
  
  var intendedWidth = document.querySelector('.wrapper').clientWidth;
  
  canvas.setAttribute('width',intendedWidth);
  
  var visualSelect = document.getElementById("visual");
  
  var drawVisual;
  
  //main block for doing the audio recording
  
  navigator.getUserMedia = getUserMedia();
  if (navigator.getUserMedia) {
     console.log('getUserMedia supported.');
     navigator.getUserMedia (
        // constraints - only audio needed for this app
        {
           audio: true
        },
  
        // Success callback
        function(stream) {
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.connect(distortion);
            distortion.connect(biquadFilter);
            gainNode.connect(audioCtx.destination);
  
            visualize();
        },
  
        // Error callback
        function(err) {
           console.log('The following gUM error occured: ' + err);
        }
     );
  } else {
     console.log('getUserMedia not supported on your browser!');
  }
  
  function visualize() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
  
  
    var visualSetting = visualSelect.value;
    console.log(visualSetting);
  
    if(visualSetting == "sinewave") {
      analyser.fftSize = 2048;
      var bufferLength = analyser.fftSize;
      console.log(bufferLength);
      var dataArray = new Uint8Array(bufferLength);
  
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
  
      function draw() {
  
        drawVisual = requestAnimationFrame(draw);
  
        analyser.getByteTimeDomainData(dataArray);
  
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
  
        canvasCtx.beginPath();
  
        var sliceWidth = WIDTH * 1.0 / bufferLength;
        var x = 0;
  
        for(var i = 0; i < bufferLength; i++) {
     
          var v = dataArray[i] / 128.0;
          var y = v * HEIGHT/2;
  
          if(i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
  
          x += sliceWidth;
        }
  
        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
      };
  
      draw();
  
    } else if(visualSetting == "frequencybars") {
      analyser.fftSize = 256;
      var bufferLength = analyser.frequencyBinCount;
      console.log(bufferLength);
      var dataArray = new Uint8Array(bufferLength);
  
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
  
      function draw() {
        drawVisual = requestAnimationFrame(draw);
  
        analyser.getByteFrequencyData(dataArray);
  
        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  
        var barWidth = (WIDTH / bufferLength) * 2.5;
        var barHeight;
        var x = 0;
  
        for(var i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];
          freqOutput.innerHTML = getFrequencyValue(dataArray[i], dataArray, audioCtx);
          canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
          canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);
  
          x += barWidth + 1;
        }
      };
  
      draw();
  
    } else if(visualSetting == "off") {
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "red";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  
  }
  
  function voiceChange() {
    distortion.curve = new Float32Array;
    distortion.oversample = '4x';
    biquadFilter.gain.value = 0;
  
    var voiceSetting = voiceSelect.value;
    console.log(voiceSetting);
  
    if(voiceSetting == "distortion") {
      distortion.curve = makeDistortionCurve(400);
    } else if(voiceSetting == "biquad") {
      biquadFilter.type = "lowshelf";
      biquadFilter.frequency.value = 1000;
      biquadFilter.gain.value = 25;
    } else if(voiceSetting == "off") {
      console.log("Voice settings turned off");
    }
  
  }
  
  // event listeners to change visualize and voice settings
  
  visualSelect.onchange = function() {
    window.cancelAnimationFrame(drawVisual);
    visualize();
  }
  
  voiceSelect.onchange = function() {
    voiceChange();
  }
  
  mute.onclick = voiceMute;
  
  function voiceMute() {
    if(mute.id == "") {
      gainNode.gain.value = 0;
      mute.id = "activated";
      mute.innerHTML = "Unmute";
    } else {
      gainNode.gain.value = 1;
      mute.id = "";    
      mute.innerHTML = "Mute";
    }
  }
  
  function getFrequencyValue(frequency, freqDomain, context) {
    var nyquist = context.sampleRate/2;
    var index = Math.round(frequency/nyquist * freqDomain.length);
    return freqDomain[index];
  }
}());