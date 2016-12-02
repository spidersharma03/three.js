#ifdef OIT

    if( bAccumPass ) { // Accumulation Pass
      float w = pow( a, 1.0 ) * clamp( 10.0 / ( 1e-5 + pow( abs( z2 ) / 5.0, 1.0 ) + pow( abs( z2 ) / 200.0, 1.0 ) ), 1e-2, 3e3 );
    }
    else { // Revealage Pass
      float w = pow( a, 1.0 ) * clamp( 10.0 / ( 1e-5 + pow( abs( z2 ) / 5.0, 1.0 ) + pow( abs( z2 ) / 200.0, 1.0 ) ), 1e-2, 3e3 );
    }

#endif
