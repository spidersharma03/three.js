#ifdef FALLOFF

float falloffModulator = abs( dot( normal, normalize( vViewPosition ) ) );

// smoothstep: this is a hack, it needs to be fixed.
falloffModulator = ( falloffModulator * falloffModulator * ( 3.0 - 2.0 * falloffModulator ) );

diffuseColor = mix( falloffDiffuseColor, diffuseColor, falloffModulator );

#endif // FALLOFF
