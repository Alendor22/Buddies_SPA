# Spatial map runtime

AR mode composes three browser-capable systems:

- rear-camera passthrough through `getUserMedia()`
- Mapbox spatial/route/community layers as a translucent overlay
- device orientation and GPS heading for camera bearing

The native ARKit/ARCore runtime remains the path for world anchors, occlusion, plane/depth sensing, and persistent camera-space objects.
