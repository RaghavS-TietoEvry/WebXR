// import * as THREE from "three";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// import * as THREE from "../node_modules/three/src/Three.js";
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.module.js";

async function ActivateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = true;

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;

  const session = await navigator.xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test", "dom-overlay"], domOverlay: { root: document.body } });
  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

  //Creating the resticle to indicate the hit point.
  const geometry = new THREE.RingGeometry(0.17, 0.2, 32);
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(0.3, 0.3, 0.3);

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

  let reticle = new THREE.Mesh(geometry, material);
  reticle.visible = false;
  scene.add(reticle);

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

      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        document.getElementById("x-coordinate").innerHTML = `${hitPose.transform.position.x.toFixed(3)}`;
        document.getElementById("y-coordinate").innerHTML = `${hitPose.transform.position.y.toFixed(3)}`;
        document.getElementById("z-coordinate").innerHTML = `${hitPose.transform.position.z.toFixed(3)}`;

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        reticle.updateMatrixWorld(true);
      }
      renderer.render(scene, camera);
    }
  };
  session.requestAnimationFrame(onXRFrame);
}

document.querySelector("#startAR").addEventListener("click", ActivateAR);
