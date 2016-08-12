/**
 * @author spidersharma03 / http://eduperiment.com
 */

THREE.CompressedBinaryWriter = function () {
};

THREE.CompressedBinaryWriter.prototype = {

	constructor: THREE.CompressedBinaryWriter,

  toBinary: function( geometry ) {
      if( !(geometry instanceof THREE.BufferGeometry) ) {
        console.warn( 'THREE.CompressedBinaryWriter::toBinary(): argument passed is not a BufferGeometry' );
        return;
      }

      var headerLength = 24;
      var totalBinLength = 0;

      var attributeInfoArray = [];
      var attributeArray = [];
      var attributes = geometry.attributes;

      // Collect Info about indices and attributes
      var indices = geometry.getIndex();
      if( indices ) {
        attributeArray['index'] = indices;
        attributeInfoArray.push({name: 'index', offset: 0, encoding: {stride: indices.itemSize, datatype: indices.array.constructor.name}, length: indices.count * indices.array.BYTES_PER_ELEMENT });
        totalBinLength += indices.count * indices.array.BYTES_PER_ELEMENT;
      }

      for( key in attributes ) {
        var attribute = attributes[key];
        var array = attribute.array;
        attributeArray[key] = attribute;
        attributeInfoArray.push({name: key, offset: totalBinLength, encoding: {stride: attribute.itemSize, datatype: array.constructor.name}, length: array.length * array.BYTES_PER_ELEMENT });
        totalBinLength += array.length * array.BYTES_PER_ELEMENT;
      }

      var jsonString = JSON.stringify(attributeInfoArray);

      var jsonLength = jsonString.length * 2;
      var bufferLength = headerLength + jsonLength + totalBinLength + (headerLength + jsonLength + totalBinLength)%4;
      var padding = (headerLength + jsonLength)%4;
      THREE.CompressedBinaryWriter.headerInfo.jsonOffset = headerLength;
      THREE.CompressedBinaryWriter.headerInfo.jsonLength = jsonLength;
      THREE.CompressedBinaryWriter.headerInfo.binBlobOffset = jsonLength + headerLength + padding;
      THREE.CompressedBinaryWriter.headerInfo.binBlobLength = totalBinLength;

      var outputBuffer = new ArrayBuffer( bufferLength );
			var outputView   = new DataView( outputBuffer );
      var offset = 0;

      this.writeHeader( outputView );
      offset += 24;

      this.writeJSON( outputView, offset, jsonString );
      offset += THREE.CompressedBinaryWriter.headerInfo.jsonLength;

      // Test
      var encodingDecodingUtility = new THREE.EncodingDecodingUtility();
			var posnArray = attributeArray['position'].array;
			var normalArray = attributeArray['normal'] !== undefined ? attributeArray['normal'].array : undefined;
			var uvArray = attributeArray['uv'] !== undefined ? attributeArray['uv'].array : undefined;
			var indicesArray;
			if( indices !== null && indices !== undefined )
				indicesArray = indices.array;

      var encodedBuffer = encodingDecodingUtility.encodeData( posnArray, normalArray, uvArray, indicesArray, 12, true );
      var decodedBuffer = encodingDecodingUtility.decodeData( encodedBuffer );
      // this.tempBuffer1 = encodedBuffer.intVertices;
			// this.tempBuffer2 = encodedBuffer.intNormals;
			// this.tempBuffer3 = encodedBuffer.intUVs;
			// this.tempBuffer4 = encodedBuffer.deltaIndices;
			// this.tempBuffer1 = posnsold;
			// this.tempBuffer2 = normalsold;
			// this.tempBuffer3 = uvsold;
			// this.tempBuffer4 = attributeArray['index'].array;

			posnArray.set(decodedBuffer.vertices);
			if(normalArray !== undefined)
				normalArray.set(decodedBuffer.normals);
			if(uvArray !== undefined)
      	uvArray.set(decodedBuffer.uvs);

			if( indices !== null && decodedBuffer.indices !== undefined )
				attributeArray['index'].array =	 decodedBuffer.indices;
      // var encodedBuffer = encodingDecodingUtility.encodeDirections( attributeArray['normal'].array, 8 );
      // var normalsnew = encodingDecodingUtility.decodeDirections( encodedBuffer );
      // var normalsold = attributeArray['normal'].array;
      // normalsold.set(normalsnew);

      // Make sure to write the binary blob after the padding offset
      offset += padding;

      var count = 0;
      for( key in attributeArray ) {
        var array = attributeArray[key].array;
        this.writeToDataViewFromTypedArray(outputView.buffer, array, offset + attributeInfoArray[count].offset, attributeInfoArray[count].length, attributeInfoArray[count].encoding.datatype );
        count++;
      }
      return outputView;
  },

  writeToDataViewFromTypedArray: function( dstArray, srcView, offset, length, datatype ) {
    var TYPED_ARRAYS = {
      'Int8Array': Int8Array,
      'Uint8Array': Uint8Array,
      'Int16Array': Int16Array,
      'Uint16Array': Uint16Array,
      'Int32Array': Int32Array,
      'Uint32Array': Uint32Array,
      'Float32Array': Float32Array,
    };
    var lengthNew = length/TYPED_ARRAYS[datatype].BYTES_PER_ELEMENT;
    var dstView = new TYPED_ARRAYS[datatype](dstArray, offset, lengthNew);
    dstView.set(srcView);
  },

  writeHeader: function( outputView ) {
    outputView.setUint32(0, THREE.CompressedBinaryWriter.headerInfo.magic);
    outputView.setUint32(4, THREE.CompressedBinaryWriter.headerInfo.version);
    outputView.setUint32(8, THREE.CompressedBinaryWriter.headerInfo.jsonOffset);
    outputView.setUint32(12, THREE.CompressedBinaryWriter.headerInfo.jsonLength);
    outputView.setUint32(16, THREE.CompressedBinaryWriter.headerInfo.binBlobOffset);
    outputView.setUint32(20, THREE.CompressedBinaryWriter.headerInfo.binBlobLength);
  },

  writeJSON: function( outputView, offset, string ) {
    for (var i = 0; i < string.length; i++) {
        outputView.setUint16( offset, string.charCodeAt(i) );
        offset += 2;
    }
  }

};

THREE.CompressedBinaryWriter.headerInfo = { magic : 1, version : 2, jsonOffset: 0, jsonLength: 0, binBlobOffset: 0, binBlobLength: 0 };

// <script src="js/utils/CompressedBinaryWriter.js"></script>
// <script src="js/utils/CompressedBinaryReader.js"></script>
//
// var compressedBinaryWriter = new THREE.CompressedBinaryWriter();
// var compressedBinaryReader = new THREE.CompressedBinaryReader();
// var binaryBuffer = compressedBinaryWriter.toBinary(geometry).buffer;
// geometry = compressedBinaryReader.toGeometryBuffer(binaryBuffer);
