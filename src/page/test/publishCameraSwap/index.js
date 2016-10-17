(function(window, document, red5pro) {
  var configuration = (function () {
    var conf = sessionStorage.getItem('r5proTestBed');
    try {
      return JSON.parse(conf);
    }
    catch (e) {
      console.error('Could not read testbed configuration from sessionstorage: ' + e.message);
    }
    return {}
  })();

  red5pro.setLogLevel(configuration.verboseLogging ? red5pro.LogLevels.TRACE : red5pro.LogLevels.WARN);

  // The two acceptable video targets on supported devices.
  var FACING_MODE_FRONT = 'user';
  var FACING_MODE_REAR = 'environment';

  var updateStatusFromEvent = window.red5proHandlePublisherEvent;
  var targetPublisher;
  var targetView;
  var streamTitle = document.getElementById('stream-title');
  var supportField = document.getElementById('support-field');
  var videoContainer = document.getElementById('video-container');

  var isSupported = navigator.mediaDevices.getSupportedConstraints()["facingMode"];
  if (isSupported) {
    supportField.innerHTML = '<em>The browser you are using </em><strong>supports</strong><em> the </em><code>facingMode</code><em> video constraint require for this test.</em>';
    supportField.classList.remove('hint-alert');
    supportField.classList.add('hint-block');
    videoContainer.addEventListener('click', function () {
      userMedia.video.facingMode = userMedia.video.facingMode === FACING_MODE_FRONT
        ? FACING_MODE_REAR : FACING_MODE_FRONT;
      resetSession();
    });
  }

  var defaultConfiguration = {
    protocol: 'ws',
    port: 8081,
    app: 'live',
    streamType: 'webrtc'
  };
  var userMedia = (function (isSupported) {
    return isSupported
      ? {
        video: {
          facingMode: FACING_MODE_FRONT
        }
      }
      : {
        video: true
      }
  })(isSupported);

  function onPublisherEvent (event) {
    console.log('[Red5ProPublisher] ' + event.type + '.');
    updateStatusFromEvent(event);
  }
  function onPublishFail (message) {
    console.error('[Red5ProPublisher] Publish Error :: ' + message);
  }
  function onPublishSuccess () {
    console.log('[Red5ProPublisher] Publish Complete.');
  }
  function onUnpublishFail (message) {
    console.error('[Red5ProPublisher] Unpublish Error :: ' + message);
  }
  function onUnpublishSuccess () {
    console.log('[Red5ProPublisher] Unpublish Complete.');
  }

  function getUserMediaConfiguration () {
   return Object.assign({}, {
      audio: configuration.audio,
      video: configuration.video
    }, userMedia);
  }

  function preview () {
    var gUM = getUserMediaConfiguration;
    return new Promise(function (resolve, reject) {

      var elementId = 'red5pro-publisher-video';
      var publisher = new red5pro.RTCPublisher();
      var view = new red5pro.PublisherView(elementId);
      var gmd = navigator.mediaDevice || navigator;

      publisher.on('*', onPublisherEvent);
      console.log('[Red5ProPublisher] gUM:: ' + JSON.stringify(gUM(), null, 2));

      gmd.getUserMedia(gUM(), function (media) {

        // Upon access of user media,
        // 1. Attach the stream to the publisher.
        // 2. Show the stream as preview in view instance.
        publisher.attachStream(media);
        view.preview(media, true);
        targetPublisher = publisher;
        targetView = view;
        resolve();

      }, function(error) {

        onPublishFail('Error - ' + error);
        reject(error);

      })
    });
  }

  function publish () {
    var publisher = targetPublisher;
    var view = targetView;
    var config = Object.assign({},
                    configuration,
                    defaultConfiguration,
                    getUserMediaConfiguration());
    config.streamName = config.stream1;
    console.log('[Red5ProPublisher] config:: ' + JSON.stringify(config, null, 2));

    view.attachPublisher(publisher);
    streamTitle.innerText = config.streamName;

    // Initialize
    publisher.init(config)
      .then(function (pub) { // eslint-disable-line no-unused-vars
        // Invoke the publish action
        return publisher.publish();
      })
      .then(function () {
        onPublishSuccess();
      })
      .catch(function (error) {
        // A fault occurred while trying to initialize and publish the stream.
        var jsonError = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
        onPublishFail('Error - ' + jsonError);
      });
  }

  function unpublish () {
    return new Promise(function (resolve, reject) {
      var view = targetView;
      var publisher = targetPublisher;
      if (publisher) {
        publisher.unpublish()
          .then(function () {
            view.view.src = '';
            publisher.setView(undefined);
            publisher.off('*', onPublisherEvent);
            onUnpublishSuccess();
            resolve();
          })
          .catch(function (error) {
            var jsonError = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
            onUnpublishFail('Unmount Error ' + jsonError);
            reject(error);
          });
      }
      else {
        onUnpublishSuccess();
        resolve();
      }
    });
  }

  function resetSession () {
    unpublish()
      .then(preview)
      .then(publish)
      .catch(function (error) {
        console.error('[Red5ProPublisher] :: Error in publishing - ' + error);
      });
  }

  // Kick off.
  preview()
    .then(publish)
    .catch(function (error) {
      console.error('[Red5ProPublisher] :: Error in publishing - ' + error);
     });

  window.addEventListener('beforeunload', function() {
    function clearRefs () {
      targetPublisher.off('*', onPublisherEvent);
      targetView = targetPublisher = undefined;
    }
    unpublish().then(clearRefs).catch(clearRefs);
  });

})(this, document, window.red5prosdk);
