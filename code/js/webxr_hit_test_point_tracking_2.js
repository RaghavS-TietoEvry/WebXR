import * as THREE from "../node_modules/three/src/Three.js";
// import { GLTFLoader } from "https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/GLTFLoader.js";

// import * as THREE from "three";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

async function ActivateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  //Scene Creation
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = true;
  renderer.setPixelRatio(window.devicePixelRatio);
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

  //Loading the Hit Marker and adding it to the scene.
  const loader = new GLTFLoader();
  let reticle;
  loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
    reticle = gltf.scene;
    reticle.scale.set(0.2, 0.2, 0.2);
    reticle.visible = true;
    scene.add(reticle);
  });

  const onXRFrame = (time, frame) => {
    session.requestAnimationFrame(onXRFrame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);

    if (pose) {
      const view = pose.views[0];

      const viewport = session.renderState.baseLayer.getViewport(view);
      renderer.setSize(viewport.width, viewport.height);
      //console.log("height: " + viewport.height + ", width:" + viewport.width);

      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      //Getting Hit Test Results from Source
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
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
