// let videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
canvasElement.style.display = 'none';
const canvasCtx = canvasElement.getContext('2d');

// import * as THREE from '../node_modules/three/build/three.module.js';
// import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
// import {
//   Lensflare,
//   LensflareElement,
// } from '../node_modules/three/examples/jsm/objects/Lensflare.js';

// import { TRIANGULATION } from '../triangulation.js';

// import { Line2 } from '../node_modules/three/examples/jsm/lines/Line2.js';
// import { LineGeometry } from '../node_modules/three/examples/jsm/lines/LineGeometry.js';
// import { LineMaterial } from '../node_modules/three/examples/jsm/lines/LineMaterial.js';

// import { MeshoptDecoder } from '../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
// import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
// import { KTX2Loader } from '../node_modules/three/examples/jsm/loaders/KTX2Loader.js';

// import { Face } from '../node_modules/kalidokit/dist/kalidokit.es.js';

async function Run() {
  const video = document.createElement('video');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      height: 480,
      width: 720,
      // width: 1920,
      // height: 1080,
      // width: 720,
      // height: 300,
    },
  });

  // Setting up the stream
  const streamSettings = stream.getVideoTracks()[0].getSettings();
  // actual width & height of the camera video
  const streamWidth = streamSettings.width;
  const streamHeight = streamSettings.height;
  video.srcObject = stream;
  video.autoplay = true;
  video.controls = false;
  // video.style.display = 'none';
  video.style.position = 'absolute';
  video.style.top = '50%';
  video.style.let = '50%';

  const stats = document.getElementById('stats');
  stats.innerHTML = `width: ${streamWidth}px; height: ${streamHeight}px`;

  video.playsInline = true;
  video.loop = true;
  video.muted = true;
  video.height = 0; // 👈️ in px
  video.width = 0; // 👈️ in px
  video.addEventListener('loadeddata', () => requestAnimationFrame(update));
  document.body.appendChild(video);

  let faceMeshVisible = false;

  console.log(streamWidth / streamHeight);
  // videoElement.width = render_w_ar;
  // videoElement.height = render_h_ar;

  const render_w = streamWidth;
  const render_h = streamHeight;
  const renderer_ar = new THREE.WebGLRenderer({ antialias: true });

  renderer_ar.setSize(streamWidth, streamHeight);

  document.body.appendChild(renderer_ar.domElement);

  const camera_ar = new THREE.PerspectiveCamera(
    63,
    streamWidth / streamHeight,
    60.0,
    500
  );
  const camera_world = new THREE.PerspectiveCamera(
    63,
    streamWidth / streamHeight,
    1.0,
    10000
  );

  camera_ar.position.set(0, 0, 100);
  camera_ar.up.set(0, 1, 0);
  camera_ar.lookAt(0, 0, 0);
  camera_ar.updateProjectionMatrix();

  camera_world.position.set(200, 0, 200);
  camera_world.up.set(0, 1, 0);
  camera_world.lookAt(0, 0, 0);

  let maskModel = null;
  let glassesModel = null;
  let sunglassesModel = null;

  const controls = new THREE.OrbitControls(camera_ar, renderer_ar.domElement);

  const scene = new THREE.Scene();

  const degrees_to_radians = (deg) => (deg * Math.PI) / 180.0;
  let unit_h = Math.tan(degrees_to_radians(camera_ar.fov / 2.0)) * 2;
  let unit_w = (unit_h / render_h) * render_w;
  const plane_geometry = new THREE.PlaneGeometry(
    unit_w * camera_ar.far,
    unit_h * camera_ar.far
  );
  const plane_material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const plane_bg = new THREE.Mesh(plane_geometry, plane_material);
  plane_bg.position.set(0, 0, -400);
  scene.add(plane_bg);

  let geometry_faceoval = new THREE.BufferGeometry();
  let linegeometry_faceoval = new THREE.LineGeometry();
  let points_faceoval = null;
  let lines_faceoval = null;
  let gl_lines_faceoval = null;
  let face_mesh = null;

  const textureLoader = new THREE.TextureLoader();
  const textureFlare0 = textureLoader.load('../lensflare0.png');
  const textureFlare3 = textureLoader.load('../lensflare3.png');

  const light_flare = new THREE.PointLight(0xffffff, 1.5, 2000);
  light_flare.color.setHSL(0.995, 0.5, 0.7);
  light_flare.position.set(0, 0, 0);

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(0, 0, 100);

  const light_ambient = new THREE.AmbientLight(
    new THREE.Color(0.5, 0.5, 0.5),
    1.0
  );

  const lensflare = new THREE.Lensflare();
  lensflare.addElement(
    new THREE.LensflareElement(textureFlare0, 200, 0, light.color)
  );
  lensflare.addElement(new THREE.LensflareElement(textureFlare3, 60, 0.6));
  lensflare.addElement(new THREE.LensflareElement(textureFlare3, 70, 0.7));
  lensflare.addElement(new THREE.LensflareElement(textureFlare3, 120, 0.9));
  lensflare.addElement(new THREE.LensflareElement(textureFlare3, 70, 1));

  light_flare.add(lensflare);
  light_flare.visible = true;
  scene.add(light_flare);
  scene.add(light);
  scene.add(light_ambient);

  let light_helper = new THREE.DirectionalLightHelper(light, 0.3);

  let blendshapeMesh,
    head,
    influences,
    faceModel,
    faceModelX,
    faceModelY,
    faceModelZ,
    faceModelRotationX;
  const ktx2Loader = new THREE.KTX2Loader()
    .setTranscoderPath('../node_modules/three/examples/js/libs/basis/')
    .detectSupport(renderer_ar);
  new THREE.GLTFLoader()
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder)
    .load('models/gltf/facecap.glb', (gltf) => {
      blendshapeMesh = gltf.scene.children[0];
      blendshapeMesh.scale.set(750, 750, 750);
      scene.add(blendshapeMesh);
      console.log(blendshapeMesh);

      head = blendshapeMesh.getObjectByName('mesh_2');
      faceModel = blendshapeMesh.getObjectByName('grp_scale');
      faceModelX = faceModel.position.x;
      faceModelY = faceModel.position.y;
      faceModelZ = faceModel.position.z;
      faceModelRotationX = faceModel.rotation.x;

      head.material.colorWrite = false;

      new THREE.GLTFLoader().load('models/gltf/mask.glb', (myModel) => {
        maskModel = myModel.scene;
        maskModel.visible = false;

        blendshapeMesh.add(maskModel);
        maskModel.scale.set(0.24, 0.24, 0.24);
        maskModel.position.y -= 0.1;
        maskModel.position.z -= 0.02;

        faceModel.position.z = faceModelZ - 0.05;

        document.getElementById('showMask').style.opacity = 1;
        document.getElementById('showMask').onclick =
          function showSunglasses() {
            maskModel.visible = true;
            glassesModel.visible = false;
            sunglassesModel.visible = false;

            faceModel.position.z = faceModelZ - 0.05;
          };
      });

      new THREE.GLTFLoader().load('models/gltf/sunglasses.glb', (myModel) => {
        sunglassesModel = myModel.scene;
        sunglassesModel.visible = false;

        blendshapeMesh.add(sunglassesModel);
        sunglassesModel.scale.set(0.0115, 0.0115, 0.0115);
        sunglassesModel.position.y -= 0.01;
        sunglassesModel.position.z += 0.0;
        sunglassesModel.rotation.x += (Math.PI / 180) * -20;

        faceModel.position.z = faceModelZ - 0.05;
        faceModel.rotation.x = faceModelRotationX + (Math.PI / 180) * -20;

        document.getElementById('showSunglasses').style.opacity = 1;
        document.getElementById('showSunglasses').onclick =
          function showSunglasses() {
            sunglassesModel.visible = true;
            maskModel.visible = false;
            glassesModel.visible = false;

            faceModel.position.z = faceModelZ - 0.05;
            faceModel.rotation.x = faceModelRotationX + (Math.PI / 180) * -20;
          };
      });

      new THREE.GLTFLoader().load('models/gltf/glasses.glb', (myModel) => {
        glassesModel = myModel.scene;
        glassesModel.visible = false;

        blendshapeMesh.add(glassesModel);
        glassesModel.scale.set(0.055, 0.055, 0.07);
        glassesModel.position.y += 0.05;
        glassesModel.position.z += 0.01;
        glassesModel.rotation.x += (Math.PI / 180) * -20;

        faceModel.position.z = faceModelZ - 0.05;
        faceModel.position.y = faceModelY + 0.01;
        faceModel.rotation.x = faceModelRotationX + (Math.PI / 180) * -20;

        document.getElementById('showGlasses').style.opacity = 1;
        document.getElementById('showGlasses').onclick =
          function showSunglasses() {
            sunglassesModel.visible = false;
            maskModel.visible = false;
            glassesModel.visible = true;

            faceModel.position.z = faceModelZ - 0.05;
            faceModel.position.y = faceModelY + 0.01;
            faceModel.rotation.x = faceModelRotationX + (Math.PI / 180) * -20;
          };
      });

      influences = head.morphTargetInfluences;
    });

  renderer_ar.domElement.style = 'touch-action:none';

  function ProjScale(p_ms, cam_pos, src_d, dst_d) {
    let vec_cam2p = new THREE.Vector3().subVectors(p_ms, cam_pos);
    return new THREE.Vector3().addVectors(
      cam_pos,
      vec_cam2p.multiplyScalar(dst_d / src_d)
    );
  }

  const faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `../node_modules/@mediapipe/face_mesh/${file}`;
    },
  });

  function onResults(results) {
    if (!blendshapeMesh) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        let count_landmarks_faceoval = FACEMESH_FACE_OVAL.length;
        if (points_faceoval == null) {
          geometry_faceoval.setAttribute(
            'position',
            new THREE.BufferAttribute(
              new Float32Array((count_landmarks_faceoval + 1) * 3),
              3
            )
          );

          points_faceoval = new THREE.Points(
            geometry_faceoval,
            new THREE.PointsMaterial({
              color: 0xff0000,
              size: 3,
              sizeAttenuation: true,
            })
          );

          let face_geometry = new THREE.BufferGeometry();
          face_geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(landmarks.length * 3), 3)
          );
          face_geometry.setAttribute(
            'uv',
            new THREE.BufferAttribute(new Float32Array(landmarks.length * 2), 2)
          );
          face_geometry.setAttribute(
            'normal',
            new THREE.BufferAttribute(new Float32Array(landmarks.length * 3), 3)
          );
          face_geometry.setIndex(TRIANGULATION);
          let face_material2 = new THREE.MeshPhongMaterial({
            color: new THREE.Color(1.0, 1.0, 1.0),
            specular: new THREE.Color(0, 0, 0),
            shininess: 1000,
          });
          face_mesh = new THREE.Mesh(face_geometry, face_material2);
          face_mesh.visible = faceMeshVisible;

          let line_geo = new THREE.BufferGeometry();
          line_geo.setAttribute(
            'position',
            new THREE.BufferAttribute(
              new Float32Array(count_landmarks_faceoval * 3),
              3
            )
          );
          let line_mat = new THREE.LineBasicMaterial({ color: 0xffff00 });
          gl_lines_faceoval = new THREE.Line(line_geo, line_mat);

          scene.add(face_mesh);
        }

        const p_c = new THREE.Vector3(0, 0, 0).unproject(camera_ar);
        const vec_cam2center = new THREE.Vector3().subVectors(
          p_c,
          camera_ar.position
        );
        const center_dist = vec_cam2center.length();

        let oval_positions = points_faceoval.geometry.attributes.position.array;

        const ip_lt = new THREE.Vector3(-1, 1, -1).unproject(camera_ar);
        const ip_rb = new THREE.Vector3(1, -1, -1).unproject(camera_ar);
        const ip_diff = new THREE.Vector3().subVectors(ip_rb, ip_lt);
        const x_scale = Math.abs(ip_diff.x);
        for (let i = 0; i < count_landmarks_faceoval; i++) {
          const index = FACEMESH_FACE_OVAL[i][0];
          let p = landmarks[index];
          let p_ms = new THREE.Vector3(
            (p.x - 0.5) * 2.0,
            -(p.y - 0.5) * 2.0,
            p.z
          ).unproject(camera_ar);
          p_ms = ProjScale(p_ms, camera_ar.position, center_dist, 100.0);

          oval_positions[i * 3 + 0] = p_ms.x;
          oval_positions[i * 3 + 1] = p_ms.y;
          oval_positions[i * 3 + 2] = p_ms.z;
        }
        oval_positions[count_landmarks_faceoval * 3 + 0] = oval_positions[0];
        oval_positions[count_landmarks_faceoval * 3 + 1] = oval_positions[1];
        oval_positions[count_landmarks_faceoval * 3 + 2] = oval_positions[2];

        let positions = face_mesh.geometry.attributes.position.array;
        let uvs = face_mesh.geometry.attributes.uv.array;
        let p_center = new THREE.Vector3(0, 0, 0);
        let p_ms_average = [0, 0, 0];

        function AreaOfTriangle(p1, p2, p3) {
          var v1 = new THREE.Vector3();
          var v2 = new THREE.Vector3();
          v1 = p1.clone().sub(p2);
          v2 = p1.clone().sub(p3);
          var v3 = new THREE.Vector3();
          v3.crossVectors(v1, v2);
          var s = v3.length() / 2;
          return s;
        }

        for (let i = 0; i < landmarks.length; i++) {
          let p = landmarks[i];

          let p_ms = new THREE.Vector3(
            (p.x - 0.5) * 2.0,
            -(p.y - 0.5) * 2.0,
            -1
          ).unproject(camera_ar);
          p_ms.z = -p.z * x_scale + camera_ar.position.z - camera_ar.near;

          p_ms = ProjScale(p_ms, camera_ar.position, camera_ar.near, 300.0);

          let pp = new THREE.Vector3().copy(p_ms);
          p_center.addVectors(p_center, pp.divideScalar(landmarks.length));

          positions[i * 3 + 0] = p_ms.x;
          positions[i * 3 + 1] = p_ms.y;
          positions[i * 3 + 2] = p_ms.z;

          p_ms_average[0] += p_ms.x;
          p_ms_average[1] += p_ms.y;
          p_ms_average[2] += p_ms.z;

          uvs[i * 2 + 0] = p.x;
          uvs[i * 2 + 1] = -p.y + 1.0;
          //console.log(p.x +", "+p.y);
        }

        p_ms_average[0] /= landmarks.length;
        p_ms_average[1] /= landmarks.length;
        p_ms_average[2] /= landmarks.length;

        blendshapeMesh.position.set(
          p_ms_average[0],
          p_ms_average[1],
          p_ms_average[2]
        );

        //rigging up by nose
        let vec_up = new THREE.Vector3().subVectors(
          landmarks[1],
          landmarks[197]
        );
        blendshapeMesh.up.set(-vec_up.x, vec_up.y, vec_up.z);

        // controls.target = p_center;
        //console.log(p_center.x + ", " + p_center.y + ", " + p_center.z);
        face_mesh.geometry.computeVertexNormals();

        let normal = face_mesh.geometry.getAttribute('normal');
        let position = face_mesh.geometry.getAttribute('position');

        const animateModel = (points) => {
          if (!blendshapeMesh || !points) return;
          let riggedFace;
          if (points) {
            // use kalidokit face solver
            riggedFace = Kalidokit.Face.solve(points, {
              runtime: 'mediapipe',
              video: video,
            });
            rigFace(riggedFace, 0.5);
          }
        };
        const rigFace = (result, lerpAmount = 0.7) => {
          if (!blendshapeMesh || !result) return;
          //influences[0] = result.brow;

          // eye blink
          function lerp(a, b, t) {
            return (1 - t) * a + t * b;
          }
          let stabilizedEyes = Kalidokit.Face.stabilizeBlink(
            {
              l: 1 - result.eye.r,
              r: 1 - result.eye.l,
            },
            result.head.y
          );
          //influences[5] = 1 - stabilizedEyes.l;
          //influences[6] = 1 - stabilizedEyes.r;
          // influences[13] = stabilizedEyes.l;
          // influences[14] = stabilizedEyes.r;
        };

        animateModel(landmarks);
        // update live2d model internal state

        let normal_vec = new THREE.Vector3(
          normal.array[588],
          normal.array[589],
          normal.array[590]
        ); //미디어파이프 페이스? 근데 468 아니었어? normal은 다른가

        let position_vec = new THREE.Vector3(
          position.array[15],
          position.array[16],
          position.array[17]
        );

        let lookat = new THREE.Vector3(0, 0, 0)
          .addVectors(normal_vec, position_vec)
          .ceil(); //올림 연산

        lookat.y -= 10;
        blendshapeMesh.lookAt(lookat);

        let landmarkArea = 0;
        for (let i = 0; i < TRIANGULATION.length / 3; i++) {
          let posVec1 = new THREE.Vector3(
            landmarks[TRIANGULATION[i * 3 + 0]].x,
            landmarks[TRIANGULATION[i * 3 + 0]].y,
            landmarks[TRIANGULATION[i * 3 + 0]].z
          );
          let posVec2 = new THREE.Vector3(
            landmarks[TRIANGULATION[i * 3 + 1]].x,
            landmarks[TRIANGULATION[i * 3 + 1]].y,
            landmarks[TRIANGULATION[i * 3 + 1]].z
          );
          let posVec3 = new THREE.Vector3(
            landmarks[TRIANGULATION[i * 3 + 2]].x,
            landmarks[TRIANGULATION[i * 3 + 2]].y,
            landmarks[TRIANGULATION[i * 3 + 2]].z
          );
          landmarkArea += AreaOfTriangle(posVec1, posVec2, posVec3);
        }

        // if you use coefficient 3.2, it's really suits you well.
        // but since I wanted to give it some marginal scale, I set coefficient as 3.6.
        //let blendshapeScale = 3.2 * Math.sqrt(tempVal);
        let blendshapeScale = 4 * Math.sqrt(landmarkArea);

        blendshapeMesh.scale.set(
          blendshapeScale,
          blendshapeScale,
          blendshapeScale
        );

        points_faceoval.geometry.attributes.position.needsUpdate = true;
        face_mesh.geometry.attributes.position.needsUpdate = true;
        face_mesh.geometry.attributes.uv.needsUpdate = true;

        let count_landmarks_left_iris = FACEMESH_LEFT_IRIS.length;
        let lm_il = [0.0, 0.0, 0.0];
        for (let i = 0; i < count_landmarks_left_iris; i++) {
          const index = FACEMESH_LEFT_IRIS[i][0];
          const p = landmarks[index];
          lm_il[0] += p.x / count_landmarks_left_iris;
          lm_il[1] += p.y / count_landmarks_left_iris;
          lm_il[2] += p.z / count_landmarks_left_iris;
        }
        let p_il_ms = new THREE.Vector3(
          (lm_il[0] - 0.5) * 2.0,
          -(lm_il[1] - 0.5) * 2.0,
          lm_il[2]
        ).unproject(camera_ar);
        p_il_ms = ProjScale(p_il_ms, camera_ar.position, center_dist, 99.9);

        light_flare.visible = true;
        light_flare.position.copy(p_il_ms);
        light.target = face_mesh;
      }
      if (face_mesh != null) {
        light_helper.update();
        let texture_frame = new THREE.CanvasTexture(results.image);

        plane_material.map = texture_frame;
        scene.background = texture_frame;
        face_mesh.material.map = texture_frame;
        scene.remove(light_helper);
        scene.remove(plane_bg);
        renderer_ar.render(scene, camera_ar);

        scene.remove(face_mesh);

        scene.background = null;
        face_mesh.material.map = texture_frame;
        scene.add(face_mesh);
        scene.add(light_helper);
        scene.add(plane_bg);
      }
    }
    canvasCtx.restore();
    controls.update();
  }

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: true,
    //enableFaceGeometry: false
  });
  faceMesh.onResults(onResults);

  async function update() {
    await faceMesh.send({ image: video });
    requestAnimationFrame(update);
  }
  // const webCamera = new Camera(videoElement, {
  //   onFrame: async () => {
  //     await faceMesh.send({ image: videoElement });
  //   },
  //   width: 1920,
  //   height: 1080,
  // });

  // webCamera.start();
}

document.getElementById('start-button').addEventListener('click', () => {
  document.getElementById('navigation').style.display = 'block';
  document.getElementById('start-button').style.display = 'none';
  Run();
});
