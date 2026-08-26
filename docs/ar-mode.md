# Buddies AR mode

Buddies web AR is a live rear-camera passthrough with the spatial Mapbox world, route, dog/report layers, heading, telemetry HUD, and targeting reticle rendered as an overlay.

The web implementation uses `navigator.mediaDevices.getUserMedia()` and device orientation where the browser permits them. It therefore requires HTTPS and user camera permission. On iOS, device orientation permission is requested from the AR button user gesture.

This mode is deliberately distinct from native world-anchored AR. Persistent AR anchors, plane detection, depth/occlusion, and camera-space 3D dog/place objects require the planned native ARKit/ARCore runtime.
