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
                forwardings: [{ actions: ['write'] }],
              },
            ],
          },
        ],
      },
    },
  }).encode('gHYUFPOituZ/3UsaCqP5sHLKsF+4i2+Z85+YuozeHEs=');
  
  (async () => {
    const localVideo = document.getElementById('js-local-stream');
  
    const joinTrigger = document.getElementById('js-join-trigger');
    const leaveTrigger = document.getElementById('js-leave-trigger');
    const remoteVideos = document.getElementById('js-remote-streams');
    const channelName = document.getElementById('js-channel-name');
  
    const roomMode = document.getElementById('js-room-type');
    const messages = document.getElementById('js-messages');
  
    const getRoomTypeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'p2p');
    
    //roomモード選択時にWindow表示を変える
    roomMode.textContent = getRoomTypeByHash();
    window.addEventListener('hashchange', () => {
      roomMode.textContent = getRoomTypeByHash();
    });
  
    //videoとaudioをSkyWayから受け取る
    const { audio, video } =
      await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();
  
    //localVideoの設定
    localVideo.muted = true;
    localVideo.playsInline = true;
    //video=localVideoにする
    video.attach(localVideo);
    //localVideoスタート
    await localVideo.play();
  
    //skywayのtokenからcontextをもらう
    const context = await SkyWayContext.Create(token, {
      log: { level: 'warn', format: 'object' },
    });
  
    let room;
  
    //joinTriggerを押したとき
    joinTrigger.addEventListener('click', async () => {
      //roomがnull?ならreturn
      if (room) {
        return;
      }
  
      //skywayからルームを作るか探してroomにルーム情報を受け取る
      room = await SkyWayRoom.FindOrCreate(context, {
        name: channelName.value,
        type: getRoomTypeByHash(),
      });
  
      //もらったroomに参加し、参加情報をmemberに受け取る
      const member = await room.join();
      //messagesに参加したことを記入
      messages.textContent += '=== You joined ===\n';
  
      //roomに他メンバーが入ってきたとき
      room.onMemberJoined.add((e) => {
        //入ってきたメンバーのIDを表示する
        messages.textContent += `=== ${e.member.id.slice(0, 5)} joined ===\n`;
      });
  
      //userVideoを空で定義する
      const userVideo = {};
  
      //menberにvideoを渡す
      member.onPublicationSubscribed.add(async ({ stream, subscription }) => {
        if (stream.contentType === 'data') return;
  
        const publisherId = subscription.publication.publisher.id;
        //publisherIdがあったとき
        if (!userVideo[publisherId]) {
          //newVideo情報を作成
          const newVideo = document.createElement('video');
          newVideo.playsInline = true;
          newVideo.autoplay = true;
          newVideo.setAttribute(
            'data-member-id',
            subscription.publication.publisher.id
          );
  
          //newVideoをremoteVideosに置く
          remoteVideos.append(newVideo);
          //userVideo[publisherId]をnewVideo情報と同じにする
          userVideo[publisherId] = newVideo;
        }
        //ifの中のuserVideo[publisherId]情報をifの外のnewVideoに渡す
        const newVideo = userVideo[publisherId];
        //stream=newVideoにする
        stream.attach(newVideo);
  
        //subscriptionのtype属性がvideoかつroomのtype属性がsfuのとき
        if (subscription.contentType === 'video' && room.type === 'sfu') {
          //newVideoがクリックされたとき
          newVideo.onclick = () => {
            //エンコの話
            if (subscription.preferredEncoding === 'low') {
              subscription.changePreferredEncoding('high');
            } else {
              subscription.changePreferredEncoding('low');
            }
          };
        }
      });
      //subscribeを定義する
      const subscribe = async (publication) => {
        if (publication.publisher.id === member.id) return;
        await member.subscribe(publication.id);
      };
      room.onStreamPublished.add((e) => subscribe(e.publication));
      room.publications.forEach(subscribe);
  
      //audioにつなげてsfuの場合とp2pの場合でvideoに繋げる
      await member.publish(audio);
      if (room.type === 'sfu') {
        await member.publish(video, {
          encodings: [
            { maxBitrate: 10_000, id: 'low' },
            { maxBitrate: 800_000, id: 'high' },
          ],
        });
      } else {
        await member.publish(video);
      }
      //disposeVideoElementを定義する
      const disposeVideoElement = (remoteVideo) => {
        const stream = remoteVideo.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      };
  
      room.onMemberLeft.add((e) => {
        if (e.member.id === member.id) return;
  
        const remoteVideo = remoteVideos.querySelector(
          `[data-member-id="${e.member.id}"]`
        );
  
        disposeVideoElement(remoteVideo);
  
        messages.textContent += `=== ${e.member.id.slice(0, 5)} left ===\n`;
      });
  
      member.onLeft.once(() => {
        Array.from(remoteVideos.children).forEach((element) => {
          disposeVideoElement(element);
        });
        messages.textContent += '== You left ===\n';
        room.dispose();
        room = undefined;
      });
  
      leaveTrigger.addEventListener('click', () => member.leave(), {
        once: true,
      });
    });
  })();