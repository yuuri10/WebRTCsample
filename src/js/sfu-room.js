import {
    nowInSec,
    SkyWayAuthToken,
    SkyWayContext,
    SkyWayRoom,
    SkyWayStreamFactory,
    uuidV4,
  } from '@skyway-sdk/room';
  
  const token = new SkyWayAuthToken({
    jti: uuidV4(),
    iat: nowInSec(),
    exp: nowInSec() + 60 * 60 * 24,
    scope: {
      app: {
        id: 'dcf87926-8f4d-429d-afd8-2fd610cd0031',
        turn: true,
        actions: ['read'],
        channels: [
          {
            id: '*',
            name: '*',
            actions: ['write'],
            members: [
              {
                id: '*',
                name: '*',
                actions: ['write'],
                publication: {
                  actions: ['write'],
                },
                subscription: {
                  actions: ['write'],
                },
              },
            ],
  
            sfuBots: [
              {
                actions: ['write'],
                forwardings: [
                  {
                    actions: ['write'],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  }).encode('gHYUFPOituZ/3UsaCqP5sHLKsF+4i2+Z85+YuozeHEs=');
  
  (async () => {
    const localVideo = document.getElementById('local-video');
    const buttonArea = document.getElementById('button-area');
    const remoteMediaArea = document.getElementById('remote-media-area');
    const channelNameInput = document.getElementById('channel-name');
  
    const myId = document.getElementById('my-id');
    const joinButton = document.getElementById('join');
  
    const { audio, video } =
      await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();
    video.attach(localVideo);
    await localVideo.play();
  
    joinButton.onclick = async () => {
      if (channelNameInput.value === '') return;
  
      const context = await SkyWayContext.Create(token);
      const channel = await SkyWayRoom.FindOrCreate(context, {
        type: 'sfu',
        name: channelNameInput.value,
      });
      const me = await channel.join();
  
      myId.textContent = me.id;
  
      await me.publish(audio);
      await me.publish(video, {
        encodings: [
          { maxBitrate: 80_000, id: 'low' },
          { maxBitrate: 400_000, id: 'high' },
        ],
      });
  
      const subscribeAndAttach = (publication) => {
        if (publication.publisher.id === me.id) return;
  
        const subscribeButton = document.createElement('button');
        subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
        buttonArea.appendChild(subscribeButton);
  
        subscribeButton.onclick = async () => {
          const { stream, subscription } = await me.subscribe(publication.id);
  
          switch (stream.contentType) {
            case 'video':
              {
                const elm = document.createElement('video');
                elm.playsInline = true;
                elm.autoplay = true;
                stream.attach(elm);
                elm.onclick = () => {
                  if (subscription.preferredEncoding === 'low') {
                    subscription.changePreferredEncoding('high');
                  } else {
                    subscription.changePreferredEncoding('low');
                  }
                };
                remoteMediaArea.appendChild(elm);
              }
              break;
            case 'audio':
              {
                const elm = document.createElement('audio');
                elm.controls = true;
                elm.autoplay = true;
                stream.attach(elm);
                remoteMediaArea.appendChild(elm);
              }
              break;
          }
        };
      };
  
      channel.publications.forEach(subscribeAndAttach);
      channel.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
    };
  })();