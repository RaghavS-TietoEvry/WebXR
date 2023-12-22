// import * as THREE from "three";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.module.js";

const maxMarkedPoints = 2;
let markedPositions = [];

async function ActivateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  //Scene Creation
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = true;
  // renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  //Camera Creation
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;

  //WebXR session creation
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    domOverlay: { root: document.body },
  });

  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  //Creating viewer space and initializing the hit test source to extract results from.
  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({
    space: viewerSpace,
  });

  //Creating the resticle to indicate the hit point.
  const geometry = new THREE.RingGeometry(0.02, 0.05, 32);
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(0.25, 0.25, 0.25);

  const material = new THREE.MeshBasicMaterial({ color: 0xcc4444 });

  let reticle = new THREE.Mesh(geometry, material);
  // reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  document.querySelector("#markPoint").addEventListener("click", () => {
    markedPositions.push(new THREE.Vector2(reticle.position.x, reticle.position.z));
    // console.log("marked array length: " + markedPositions.length);

    if (markedPositions.length >= maxMarkedPoints) {
      Object.freeze(markedPositions);
    }
  });

  document.querySelector("#distance").addEventListener("click", () => {
    if (markedPositions.length && markedPositions.length >= 2) {
      var dx = markedPositions[0].x - markedPositions[1].x;
      //   console.log(markedPositions[0].x + " " + markedPositions[1].x);
      //   console.log("dx: " + dx);
      var dy = markedPositions[0].y - markedPositions[1].y;
      //   console.log(markedPositions[0].y + " " + markedPositions[1].y);
      //   console.log("dy: " + dy);

      var distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

      //   console.log(distance);
      document.querySelector("#distance-value").innerHTML = distance.toFixed(3) + "m";
    } else {
      console.log("Array is empty OR doesn't have enough elements to calculate distance");
    }
  });

  const onXRFrame = (time, frame) => {
    session.requestAnimationFrame(onXRFrame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);

    if (pose) {
      const view = pose.views[0];
      const viewport = session.renderState.baseLayer.getViewport(view);

      renderer.setSize(viewport.width, viewport.height);

      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      //Getting Hit Test Results from Source
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        // reticle.matrix.fromArray(hitPose.transform.matrix);
        reticle.updateMatrixWorld(true);

        document.getElementById("x-coordinate").innerHTML = `${hitPose.transform.position.x.toFixed(3)}`;
        document.getElementById("y-coordinate").innerHTML = `${hitPose.transform.position.y.toFixed(3)}`;
        document.getElementById("z-coordinate").innerHTML = `${hitPose.transform.position.z.toFixed(3)}`;
      }
      renderer.render(scene, camera);
    }
  };
  session.requestAnimationFrame(onXRFrame);
}

document.getElementById("startAR").addEventListener("click", ActivateAR);
