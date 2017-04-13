function createClippedSphereFormFactorTexture() {

  var nDivOmega = 180, nDivSigma = 90;
  this.formFactors = new Float32Array( nDivOmega * nDivSigma );

  function generateFormFactors() {
    let sigma = 0, omega = 0;
    let deltaOmega = 1/(nDivOmega - 1);
    let deltaSigma = 1/(nDivSigma - 1);

    for( let i=0; i<nDivSigma; i++) {
      omega = 0;
      for( let j=0; j<nDivOmega; j++) {

          let cosOmega = Math.cos( omega );
          let sinOmega = Math.sin( omega );
          let cosSigma = Math.cos( sigma );
          let sinSigma = Math.sin( sigma );
          let value = 0;

          if( sigma >=0 && sigma < Math.PI/2 - sigma ) {
            value = Math.PI * cosOmega * sinSigma * sinSigma;
          }
          else if( sigma >= Math.PI/2 - sigma && sigma < Math.PI/2 ) {
            let gamma = math.asin(cosSigma/sinOmega);
            let sinGamma = Math.sin(gamma);
            let cosGamma = Math.cos(gamma);

            let G = -2 * sinOmega * cosSigma * cosGamma + Math.PI/2 - gamma + sinGamma * cosGamma;
            let H = cosOmega * (cosGamma * Math.sqrt( sinSigma * sinSigma - cosGamma * cosGamma ) + sinSigma * sinSigma * Math.asin( cosGamma/sinSigma ));
            value = Math.PI * cosOmega * sinSigma * sinSigma + G - H;
          }
          else if( sigma >= Math.PI/2 && sigma < Math.PI/2 + sigma ) {
            let G = -2 * sinOmega * cosSigma * cosGamma + Math.PI/2 - gamma + sinGamma * cosGamma;
            let H = cosOmega * (cosGamma * Math.sqrt( sinSigma * sinSigma - cosGamma * cosGamma ) + sinSigma * sinSigma * Math.asin( cosGamma/sinSigma ));
            value = G + H;
          }
          else if(  sigma >= Math.PI/2 + sigma ) {
            value = 0;
          }
          this.formFactors[j + i * nDivSigma] = value;
          omega += deltaOmega;
      }
      sigma += deltaSigma;
    }
  }

  generateFormFactors();

  let dataTexture = new THREE.DataTexture(floatArray, this.formFactors.length, 1);
  dataTexture.format = THREE.LuminanceFormat;
  dataTexture.type = THREE.FloatType;
  dataTexture.minFilter = THREE.LinearFilter;
  dataTexture.magFilter = THREE.LinearFilter;
  dataTexture.generateMipmaps = false;
  dataTexture.needsUpdate = true;
  return dataTexture;
}
