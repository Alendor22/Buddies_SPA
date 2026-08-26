# AR camera acceptance checklist

1. Open `/map` on an HTTPS deployment using a phone with a rear camera.
2. Tap **AR**.
3. Confirm the browser requests camera permission when permission has not already been granted.
4. Grant camera permission and confirm the rear camera feed fills the screen.
5. Confirm the Mapbox spatial view remains visible as a translucent overlay.
6. Confirm the top status reads **AR CAMERA LIVE**.
7. Confirm the reticle, telemetry HUD, Buddies/report layers, and action bar remain visible.
8. Rotate the phone and confirm map bearing follows device heading where orientation permission is granted.
9. Tap **AR On** to exit; confirm the camera track stops and the normal opaque map returns.
10. Repeat with camera permission denied and confirm explicit recovery guidance is shown instead of a silent no-op.
