import { ARUtils } from 'three.ar.js';
import initWebScene from './ParticleScene'
import initARScene from './ParticleARScene'


document.body.style.margin = "0";

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API
 * to see if there are any AR-capable WebVR VRDisplays. Returns
 * a valid display if found. Otherwise, display the unsupported
 * browser message.
 */
ARUtils.getARDisplay().then(function (display) {
  if (display) {
    initARScene(display);
  } else {
    ARUtils.displayUnsupportedMessage();
    const messageElement = document.getElementById("webgl-error-message");

    messageElement.style.color = "white";
    messageElement.style.background = "transparent";
    messageElement.style.border = "1px solid white";

    const containerDiv = document.createElement("div")
    containerDiv.style.margin = "auto"
    containerDiv.style.position = "fixed"
    containerDiv.style.width = "100%"

    document.body.appendChild(containerDiv)
    containerDiv.appendChild(messageElement)

    initWebScene();
  }
});
