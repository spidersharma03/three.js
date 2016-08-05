/**
 * @author spidersharma03 / http://eduperiment.com
 */

THREE.CompressedBinaryReader = function () {
};

THREE.CompressedBinaryReader.prototype = {

	constructor: THREE.CompressedBinaryReader,

  toGeometryBuffer: function( dataView ) {

		var geometry = new THREE.BufferGeometry();

    var offset = 0;
		var headerInfo = this.readHeader( dataView );
		offset += 24;

		var jsonString = this.readJsonInfo( dataView, offset, headerInfo.jsonLength );
    var attributesArray = JSON.parse( jsonString );

    for( key in attributesArray ) {
      var attribute = attributesArray[key];
      var name = attribute.name;
      var offset = headerInfo.binBlobOffset + attribute.offset;
      var length = attribute.length;
			var encoding = attribute.encoding;
			var typedArray = this.createTypedArrayFromDataView( dataView, offset, length, encoding.datatype );
			var bufferAttribute = new THREE.BufferAttribute( typedArray, encoding.stride );
			if( name === "index") {
				geometry.setIndex(bufferAttribute);
			}
			else {
				geometry.addAttribute( name, bufferAttribute );
			}
    }
		return geometry;
  },

	readHeader: function( dataView ) {
		var major = dataView.getUint32(0);
    var version = dataView.getUint32(4);
    var jsonOffset = dataView.getUint32(8);
    var jsonLength = dataView.getUint32(12);
    var binBlobOffset = dataView.getUint32(16);
    var binBlobLength = dataView.getUint32(20);
		return {major, version, jsonOffset, jsonLength, binBlobOffset, binBlobLength};
	},

	readJsonInfo: function( dataView, offset, jsonLength ) {
		var jsonString = "";
    for(var i = 0; i < jsonLength/2; i++ ) {
      var charCode = dataView.getUint16(offset); offset += 2;
      jsonString += String.fromCharCode(charCode);
    }
		return jsonString;
	},

	createTypedArrayFromDataView: function( srcArray, offset, length, datatype ) {
		var TYPED_ARRAYS = {
			'Int8Array': Int8Array,
			'Uint8Array': Uint8Array,
			'Int16Array': Int16Array,
			'Uint16Array': Uint16Array,
			'Int32Array': Int32Array,
			'Uint32Array': Uint32Array,
			'Float32Array': Float32Array,
		};
		var lengthNew = Math.round(length/TYPED_ARRAYS[datatype].BYTES_PER_ELEMENT);
		var dst32 = new TYPED_ARRAYS[datatype](lengthNew);
 		var src32 = new TYPED_ARRAYS[datatype](srcArray.buffer, offset, lengthNew);
 		dst32.set(src32);
		return src32;
	}

};
