THREE.DataViewContainer = function( dataView ) {
  var offset = 0;
  this.headerInfo = this.readHeader( dataView );
  offset += 24;

  var jsonString = this.readJsonInfo( dataView, offset, headerInfo.jsonLength );
  this.jsonInfo = JSON.parse( jsonString );

}

THREE.DataViewContainer.prototype = {
  constructor: THREE.DataViewContainer,

  getHeaderInfo: function() {
    return this.headerInfo;
  },

  getJsonInfo: function() {
    return this.jsonInfo;
  },

  getPositionBuffer: function() {

  },

  getNormalBuffer: function() {

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

}

THREE.CompressedBinaryReader.prototype = {

	constructor: THREE.CompressedBinaryReader,

  readBuffers: function( dataView ) {

    for( key in attributesArray ) {
      var attribute = attributesArray[key];
      var name = attribute.name;
      var offset = headerInfo.binBlobOffset + attribute.offset;
      var length = attribute.length;
			var encoding = attribute.encoding;
			var typedArray = this.getTypedArrayFromDataView( dataView, offset, length, encoding.datatype );
      if( name === 'position' ) {
        this.positionBuffer = typedArray;
      }
      if( name === 'normal' ) {
        this.normalBuffer = typedArray;
      }
    }
		return geometry;
  },

	getTypedArrayFromDataView: function( srcArray, offset, length, datatype ) {
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
 		var src32 = new TYPED_ARRAYS[datatype](srcArray.buffer, offset, lengthNew);
		return src32;
	}

};
