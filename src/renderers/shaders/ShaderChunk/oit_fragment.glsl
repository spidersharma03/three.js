#ifdef USE_OIT

    if( oitMode == 0 ) { // Accumulation Pass
      float z = abs(vPositionZ);
      float weight = max((min(1.0, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * gl_FragColor.a)), gl_FragColor.a) * clamp(0.03 / (1e-5 + pow(z / 200.0, 4.0)), 1e-2, 3e3);
      weight = pow( gl_FragColor.a, 1.0 ) * clamp( 10.0 / ( 1e-5 + pow( abs( z ) / 5.0, 1.0 ) + pow( abs( z ) / 200.0, 1.0 ) ), 1e-2, 3e3 );
      gl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, gl_FragColor.a) * weight;
    }
    else if( oitMode == 1 ) { // Revealage Pass
      float z = abs(vPositionZ);
      float weight = max((min(1.0, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * gl_FragColor.a)), gl_FragColor.a) * clamp(0.03 / (1e-5 + pow(z / 200.0, 4.0)), 1e-2, 3e3);
      weight = pow( gl_FragColor.a, 1.0 ) * clamp( 10.0 / ( 1e-5 + pow( abs( z ) / 5.0, 1.0 ) + pow( abs( z ) / 200.0, 1.0 ) ), 1e-2, 3e3 );
      gl_FragColor = vec4(gl_FragColor.a);
    }

#endif
