/* @author spidersharma03 / http://eduperiment.com/
*/

//Represents 3D Grid for quantization

THREE.Grid = function() {
  this.min = new THREE.Vector3();
  this.max = new THREE.Vector3();
  this.division = new THREE.Vector3();
  this.size = new THREE.Vector3();
};

// Used for creating sorted vertices, in order to prepare for compression
THREE.SortVertex = function() {
  // Grid index. This is the index into the 3D space subdivision grid.
  this.gridIndex = -1;
  // Original index (before sorting).
  this.originalIndex = -1;
};

THREE.EncodingDecodingUtility = function() {
};

THREE.EncodingDecodingUtility.prototype = {
  constructor: THREE.EncodingDecodingUtility,

  setupQuantizedGrid: function( vertices, quantizedBits)
  {
    var grid = new THREE.Grid();
    quantizedBits = quantizedBits !== undefined ? quantizedBits : 15;

    grid.min.x = grid.max.x = vertices[0];
    grid.min.y = grid.max.y = vertices[1];
    grid.min.z = grid.max.z = vertices[2];
    var numVertices = Math.floor(vertices.length/3);
    for(var i = 1; i < numVertices; i++ )
    {
      if(vertices[3 * i] < grid.min.x)
        grid.min.x = vertices[3 * i];
      else if(vertices[3 * i] > grid.max.x)
        grid.max.x = vertices[3 * i];
      if(vertices[3 * i + 1] < grid.min.y)
        grid.min.y = vertices[3 * i + 1];
      else if(vertices[3 * i + 1] > grid.max.y)
        grid.max.y = vertices[3 * i + 1];
      if(vertices[3 * i + 2] < grid.min.z)
        grid.min.z = vertices[3 * i + 2];
      else if(vertices[3 * i + 2] > grid.max.z)
        grid.max.z = vertices[3 * i + 2];
    }

    var numDivs = Math.pow( 2.0, quantizedBits);
    grid.division.x = grid.division.y = grid.division.z = numDivs;

    grid.size.x = (grid.max.x - grid.min.x) / (numDivs - 1);
    grid.size.y = (grid.max.y - grid.min.y) / (numDivs - 1);
    grid.size.z = (grid.max.z - grid.min.z) / (numDivs - 1);
    return grid;
  },

  // Quantization of Positions, Normals and UV's.
  quantizePositions: function( vertices, intVertices, grid)
  {
    var numVertices = Math.floor(vertices.length/3);
    for(var i = 0; i < numVertices; i++ ) {
      intVertices[3 * i] = Math.floor( (vertices[3 * i] - grid.min.x)/grid.size.x );
      intVertices[3 * i + 1] = Math.floor( (vertices[3 * i + 1] - grid.min.y)/grid.size.y );
      intVertices[3 * i + 2] = Math.floor( (vertices[3 * i + 2] - grid.min.z)/grid.size.z );
    }
  },

  /* sortVertices are passed in order to make sure that the normals and uv's are stored in the same
     way as vertices. After the vertices are sorted, the SortVertex contains the original index. this
     is used to calculate the normals and uv's properly. In case of more attributes are used, the same
     procedure should be followed.
  */
  quantizeNormals( normals, intNormals, sortVertices, quantizedBits) {
    var i, oldIdx;
    var numVertices = Math.floor(normals.length/3);
    var maxInt = Math.pow( 2, quantizedBits);

    for(i = 0; i < numVertices; i++) {
      oldIdx = sortVertices === undefined ? i : sortVertices[i].originalIndex;
      var id0 = 3*oldIdx;
      var id1 = 3*oldIdx + 1;
      var id2 = 3*oldIdx + 2;

      var x = normals[id0];
      var y = normals[id1];
      var z = normals[id2];
      var theta = Math.floor(Math.acos(y)/Math.PI * maxInt );
      var phi = Math.floor( ( Math.PI + Math.atan2( z, x) ) / ( 2.0 * Math.PI ) * maxInt);
      intNormals[2 * i] = theta;
      intNormals[2 * i + 1] = phi;
    }
  },

  quantizeUVs( uvs, intUVs, sortVertices, quantizedBits) {
    var i, j, oldIdx, intPhi;
    var numVertices = Math.floor(uvs.length/2);
    var maxInt = Math.pow( 2, quantizedBits);

    for(i = 0; i < numVertices; i++)
    {
      oldIdx = sortVertices === undefined ? i : sortVertices[i].originalIndex;
      var id0 = 2*oldIdx;
      var id1 = 2*oldIdx + 1;

      var x = Math.floor(uvs[id0] * maxInt);
      var y = Math.floor(uvs[id1] * maxInt);
      intUVs[2 * i] = x;
      intUVs[2 * i + 1] = y;
    }
  },

  /* Applies simple delta transform on the data, which can be vertices, normals uv's or arbitrary
     attributes. This helps in reducing the entropy, so that a more generic compression algorithm
     can do a better compression. Note that, generally the data is sorted before applying the transform.
  */
  applyDeltaTransform: function(data, itesize) {

    var numVertices = Math.floor(data.length/itesize);
    var current = [0,0,0], previous = [0,0,0];

    for(i = 0; i < numVertices; i++ ) {

      for( var j = 0; j < itesize; j++ ) {
        current[j] = data[ itesize * i + j ];
        data[ itesize * i + j ] = current[j] - previous[j];
        previous[j] = current[j];
      }

    }
  },

  invertDeltaTransform: function( vertices, itesize ) {
    var numVertices = Math.floor(vertices.length/itesize);
    for(i = 1; i < numVertices; i++ )
    {
      for( var j = 0; j < itesize; j++ )
        vertices[itesize * i + j]  += vertices[itesize * (i-1) + j];
    }
  },

  deQuantizePositions: function( intVertices, vertices, grid ) {
    var numVertices = Math.floor(vertices.length/3);
    for(var i = 0; i < numVertices; i++ )
    {
      var ix = intVertices[3 * i];
      var iy = intVertices[3 * i + 1];
      var iz = intVertices[3 * i + 2];

      vertices[3 * i] = grid.min.x + ix * grid.size.x;
      vertices[3 * i + 1] = grid.min.y + iy * grid.size.y;
      vertices[3 * i + 2] = grid.min.z + iz * grid.size.z;
    }
  },

  deQuantizeNormals: function(intNormals, normals, quantizedBits ) {
    var maxInt = Math.pow( 2, quantizedBits);
    var numDirections = Math.floor(intNormals.length/2);
    for( var i=0; i< numDirections; i++ ) {
      var theta = intNormals[2 * i] * Math.PI/maxInt;
      var phi = intNormals[2 * i + 1] * 2.0 * Math.PI/maxInt;
      phi -= Math.PI;
      var x = Math.sin(theta) * Math.cos(phi);
      var z = Math.sin(theta) * Math.sin(phi);
      var y = Math.cos(theta);
      normals[3 * i] = x;
      normals[3 * i + 1] = y;
      normals[3 * i + 2] = z;
    }
  },

  deQuantizeUVs: function(intUVs, uvs, quantizedBits ) {
    var maxInt = Math.pow( 2, quantizedBits);
    var numUVs = Math.floor(intUVs.length/2);
    for( var i=0; i< numUVs; i++ ) {
      var u = intUVs[2 * i]/maxInt;
      var v = intUVs[2 * i + 1]/maxInt;
      uvs[2 * i] = u;
      uvs[2 * i + 1] = v;
    }
  },

  /* Sort the vertices by their grid indices. This stage prepares the vertices to apply
     a delta transform.
  */
  sortVertices: function(vertices, sortVertices, grid) {
    var numVertices = Math.floor(vertices.length/3);
    for(var i = 0; i < numVertices; i++ )
    {
      var idx = vertices[3 * i];
      var idy = vertices[3 * i + 1];
      var idz = vertices[3 * i + 2];
      sortVertices[i].gridIndex = idx + grid.division.x * ( idy + grid.division.y * idz );
      sortVertices[i].originalIndex = i;
    }

    function compareVertex(elem1, elem2) {
        return elem1.gridIndex - elem2.gridIndex;
    }

    sortVertices.sort( compareVertex );

    var gridIdx, gridIdy, gridIdz, zdiv, ydiv;

    for(var i = 0; i < numVertices; i++ ) {
      var gridIndex = sortVertices[i].gridIndex;

      zdiv = grid.division.x * grid.division.y;
      ydiv = grid.division.x;

      gridIdz =  Math.floor(gridIndex / zdiv);
      gridIndex -= gridIdz * zdiv;
      gridIdy =  Math.floor(gridIndex / ydiv);
      gridIndex -= gridIdy * ydiv;
      gridIdx = Math.floor(gridIndex);

      vertices[3 * i] = gridIdx;
      vertices[3 * i + 1] = gridIdy;
      vertices[3 * i + 2] = gridIdz;
    }
  },

  // ReIndex the indices array, after the vertices has been sorted.
  reIndexIndices: function( sortVertices, oldIndices, newIndices) {
    var indexLUT = new Uint32Array( sortVertices.length );

    for(var i = 0; i < sortVertices.length; ++ i)
      indexLUT[sortVertices[i].originalIndex] = i;

    for(i = 0; i < oldIndices.length; ++ i)
      newIndices[i] = indexLUT[oldIndices[i]];
  },

  /* ReIndex the indices array by re arranging the triangles sorted by grid indices. Helps in
     reducing the entropy. */
  reArrangeTriangles: function( indices ) {
    var tri0 ,tri1, tri2, tmp;
    var mTriangleCount = Math.floor(indices.length);
    // Step 1: Make sure that the first index of each triangle is the smallest
    // one (rotate triangle nodes if necessary)
    for(var i = 0; i < mTriangleCount; i+=3 )
    {
      tri0 = indices[i];
      tri1 = indices[i + 1];
      tri2 = indices[i + 2];
      if((tri1 < tri0) && (tri1 < tri2))
      {
        tmp = tri0;
        indices[i] = tri1;
        indices[i + 1] = tri2;
        indices[i + 2] = tmp;
      }
      else if((tri2 < tri0) && (tri2 < tri1))
      {
        tmp = tri0;
        indices[i] = tri2;
        indices[i + 2] = tri1;
        indices[i + 1] = tmp;
      }
    }
    // Push indices into triangle objects
    var triangleArray = [];
    for( i=0; i < indices.length; i+=3 ) {
      triangleArray.push( {id0:indices[i], id1:indices[i + 1], id2:indices[i + 2]});
    }

    // Sort triangles based upon first grid index
    function compareTriangle(tri1, tri2)
    {
      if(tri1.id0 != tri2.id0)
        return tri1.id0 - tri2.id0;
      else
        return tri1.id1 - tri2.id1;
    }
    triangleArray.sort(compareTriangle);

    // Copy back
    for( i=0; i < triangleArray.length; i++ ) {
      indices[3 * i]     = triangleArray[i].id0;
      indices[3 * i + 1] = triangleArray[i].id1;
      indices[3 * i + 2] = triangleArray[i].id2;
    }
  },

  // Delta transform on the indices.
  makeIndexDeltas: function( indices ) {
    var mTriangleCount = Math.floor(indices.length/3);
    for(var i = mTriangleCount - 1; i >= 0; -- i)
    {
      // Step 1: Calculate delta from second triangle index to the previous
      // second triangle index, if the previous triangle shares the same first
      // index, otherwise calculate the delta to the first triangle index
      if((i >= 1) && (indices[i * 3] == indices[(i - 1) * 3]))
        indices[i * 3 + 1] -= indices[(i - 1) * 3 + 1];
      else
        indices[i * 3 + 1] -= indices[i * 3];

      // Step 2: Calculate delta from third triangle index to the first triangle
      // index
      indices[i * 3 + 2] -= indices[i * 3];

      // Step 3: Calculate derivative of the first triangle index
      if(i >= 1)
        indices[i * 3] -= indices[(i - 1) * 3];
    }
  },

  /* SmoothNormals calculation for creating reference normals, used to calculate delta Normals.
     The vertices, and the indices must be in the same space, that is sorted or not sorted.
  */
  calculateTriangleSmoothNormals: function(vertices, indices, smoothNormals) {
    var i, j, k, tri = [];
    var len;
    var v1 = [], v2 = [], n = [];
    var numTriangles = Math.floor(indices.length/3);
    // Calculate sums of all neigbouring triangle normals for each vertex
    for(i = 0; i < numTriangles; ++ i)
    {
      // Get triangle corner indices
      for(j = 0; j < 3; ++ j)
        tri[j] = indices[i * 3 + j];

      // Calculate the normalized cross product of two triangle edges (i.e. the
      // flat triangle normal)
      for(j = 0; j < 3; ++ j)
      {
        v1[j] = vertices[tri[1] * 3 + j] - vertices[tri[0] * 3 + j];
        v2[j] = vertices[tri[2] * 3 + j] - vertices[tri[0] * 3 + j];
      }
      n[0] = v1[1] * v2[2] - v1[2] * v2[1];
      n[1] = v1[2] * v2[0] - v1[0] * v2[2];
      n[2] = v1[0] * v2[1] - v1[1] * v2[0];
      len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if(len > 1e-10)
        len = 1.0 / len;
      else
        len = 1.0;
      for(j = 0; j < 3; ++ j)
        n[j] *= len;

      // Add the flat normal to all three triangle vertices
      for(k = 0; k < 3; ++ k)
        for(j = 0; j < 3; ++ j)
          smoothNormals[tri[k] * 3 + j] += n[j];
    }

    // Normalize the normal sums, which gives the unit length smooth normals
    var numVertices = Math.floor(vertices.length/3);
    for(i = 0; i < numVertices; ++ i)
    {
      len = Math.sqrt(smoothNormals[i * 3] * smoothNormals[i * 3] +
                  smoothNormals[i * 3 + 1] * smoothNormals[i * 3 + 1] +
                  smoothNormals[i * 3 + 2] * smoothNormals[i * 3 + 2]);
      if(len > 1e-10)
        len = 1.0 / len;
      else
        len = 1.0;
      for(j = 0; j < 3; ++ j)
        smoothNormals[i * 3 + j] *= len;
    }
  },

  // Makes a local coordinate system, where z axis is along the smooth normal.
  makeNormalCoordSys: function( normal,  aBasisAxes) {
    var len;
    // normal (must be unit length!)
    aBasisAxes.elements[6] = normal.x;
    aBasisAxes.elements[7] = normal.y;
    aBasisAxes.elements[8] = normal.z;

    // Calculate a vector that is guaranteed to be orthogonal to the normal, non-
    // zero, and a continuous function of the normal (no discrete jumps):
    // X = (0,0,1) x normal + (1,0,0) x normal
    aBasisAxes.elements[0] =  -normal.y;
    aBasisAxes.elements[1] =  normal.x - normal.z;
    aBasisAxes.elements[2] =  normal.y;

    // Normalize the new X axis (note: |x[2]| = |x[0]|)
    len = Math.sqrt(2.0 * aBasisAxes.elements[0] * aBasisAxes.elements[0] + aBasisAxes.elements[1] * aBasisAxes.elements[1]);
    if(len > 1.0e-20)
    {
      len = 1.0 / len;
      aBasisAxes.elements[0] *= len;
      aBasisAxes.elements[1] *= len;
      aBasisAxes.elements[2] *= len;
    }

    // Let Y = Z x X  (no normalization needed, since |Z| = |X| = 1)
    aBasisAxes.elements[3] = aBasisAxes.elements[7] * aBasisAxes.elements[2] - aBasisAxes.elements[8] * aBasisAxes.elements[1];
    aBasisAxes.elements[4] = aBasisAxes.elements[8] * aBasisAxes.elements[0] - aBasisAxes.elements[6] * aBasisAxes.elements[2];
    aBasisAxes.elements[5] = aBasisAxes.elements[6] * aBasisAxes.elements[1] - aBasisAxes.elements[7] * aBasisAxes.elements[0];
  },

  /* DeltaNormals calculation for creating reference normals. The vertices, normals, and the indices
     must be in the same space, that is, sorted or not sorted.
  */
  makeNormalDeltasRelativeToSmoothNormals: function( normals, intNormals, vertices, indices, sortVertices, quantizedBits) {
    var oldIdx;
    var phi, theta;
    var n = [], n2 = [], basisAxes = new THREE.Matrix3();
    var normal = new THREE.Vector3();
    var maxInt = Math.pow( 2, quantizedBits);

    var smoothNormals = new Float32Array(normals.length);
    this.calculateTriangleSmoothNormals(vertices, indices, smoothNormals);

    var numVertices = Math.floor(vertices.length/3);

    for( var i = 0; i < numVertices; i++ ) {
      // Get old normal index (before vertex sorting)
      oldIdx = sortVertices[i].originalIndex;

      for( var j = 0; j < 3; j++ )
        n[j] = normals[oldIdx * 3 + j];

      // Convert the normal to angular representation (phi, theta) in a coordinate
      // system where the nominal (smooth) normal is the Z-axis
      normal.x = smoothNormals[i * 3];
      normal.y = smoothNormals[i * 3 + 1];
      normal.z = smoothNormals[i * 3 + 2];
      this.makeNormalCoordSys(normal, basisAxes);
      for(j = 0; j < 3; ++ j) {
        n2[j] = basisAxes.elements[j * 3] * n[0] +
                basisAxes.elements[j * 3 + 1] * n[1] +
                basisAxes.elements[j * 3 + 2] * n[2];
      }

      theta = Math.acos(n2[2])/Math.PI * maxInt;
      phi = (Math.PI + Math.atan2(n2[1], n2[0]))/(2*Math.PI) * maxInt;

      intNormals[i * 2] = Math.floor(theta);
      intNormals[i * 2 + 1] = Math.floor(phi);
    }
  },

  /* Inverts the DeltaNormals calculation for creating normals. The vertices, intNormals, and the indices
     must be in the same space, that is, sorted or not sorted.
  */
  restoreNormalsRelativeToSmoothNormals: function(intNormals, normals, vertices, indices, quantizedBits) {
    var i, j;
    var n = [], n2 = [], basisAxes = new THREE.Matrix3();
    var normal = new THREE.Vector3();
    // Allocate temporary memory for the nominal vertex normals
    var smoothNormals = new Float32Array(normals.length);
    var maxInt = Math.pow( 2, quantizedBits);

    // Calculate smooth normals (nominal normals)
    this.calculateTriangleSmoothNormals( vertices, indices, smoothNormals);
    var numVertices = Math.floor(normals.length/3);

    for(i = 0; i < numVertices; ++ i)
    {
      // Get phi and theta (spherical coordinates, relative to the smooth normal).
      var theta = intNormals[2 * i] * Math.PI/maxInt;
      var phi = intNormals[2 * i + 1] * 2.0 * Math.PI/maxInt;
      phi -= Math.PI;
      // Convert the normal from the angular representation (phi, theta) back to
      // cartesian coordinates
      n2[0] = Math.sin(theta) * Math.cos(phi);
      n2[1] = Math.sin(theta) * Math.sin(phi);
      n2[2] = Math.cos(theta);
      normal.x = smoothNormals[i * 3];
      normal.y = smoothNormals[i * 3 + 1];
      normal.z = smoothNormals[i * 3 + 2];

      this.makeNormalCoordSys(normal, basisAxes);
      for(j = 0; j < 3; ++ j)
        n[j] = basisAxes.elements[j] * n2[0] +
               basisAxes.elements[3 + j] * n2[1] +
               basisAxes.elements[6 + j] * n2[2];

      for(j = 0; j < 3; ++ j)
        normals[i * 3 + j] = n[j];
    }
  },

  // Inverts the delta transform on indices
  restoreIndices: function( indices )
  {
    var i;
    var mTriangleCount = Math.floor(indices.length/3);

    for(i = 0; i < mTriangleCount; ++ i)
    {
      // Step 1: Reverse derivative of the first triangle index
      if(i >= 1)
        indices[i * 3] += indices[(i - 1) * 3];

      // Step 2: Reverse delta from third triangle index to the first triangle
      // index
      indices[i * 3 + 2] += indices[i * 3];

      // Step 3: Reverse delta from second triangle index to the previous
      // second triangle index, if the previous triangle shares the same first
      // index, otherwise reverse the delta to the first triangle index
      if((i >= 1) && (indices[i * 3] == indices[(i - 1) * 3]))
        indices[i * 3 + 1] += indices[(i - 1) * 3 + 1];
      else
        indices[i * 3 + 1] += indices[i * 3];
    }
  },

  /* Restores the data from the shuffeled indices, due to sorting. This will be needed when
     we don't want to reset the indices on the original geometry.
  */
  restoreDataOrder: function( buffer, indices, itesize ) {
    var restoredData = new buffer.constructor(buffer.length);
    for( var i = 0; i < indices.length; i++ ) {
      var id0 = indices[i];
      for( var j = 0; j < itesize; j++) {
        restoredData[itesize * i + j] = buffer[itesize * id0 + j];
      }
    }
    // Copy back
    buffer.set(restoredData);
  },

  createSortedVertices: function(numVertices) {
    var sortVertices = [];
    for( var i = 0; i < numVertices; i++ ) {
      sortVertices.push(new THREE.SortVertex());
    }
    return sortVertices;
  },

  createDummyIndices: function( numVertices ) {
    var indices = new Int32Array( numVertices );
    for( var i=0; i < numVertices; i++ ) {
      indices[i] = i;
    }
    return indices;
  },

  encodeData: function( positions, normals, uvs, indices, options ) {
    options = options || {};
    var quantizedBitsPositions = options.quantizedBitsPositions;
    var quantizedBitsNormals   = options.quantizedBitsNormals || 12;
    var quantizedBitsUVs       = options.quantizedBitsUVs || 12;
    var useSmoothNormals       = options.useSmoothNormals;

    var grid = this.setupQuantizedGrid( positions, quantizedBitsPositions );

    var intVertices = new Int16Array( positions.length );
    this.quantizePositions( positions, intVertices, grid );

    var numVertices = Math.floor( positions.length/3 );
    var hasIndices = (indices !== undefined) && (indices !== null);
    indices = indices || this.createDummyIndices( numVertices );

    var newIndices = new Int32Array( indices.length );

    var sortVertices = this.createSortedVertices(numVertices);

    this.sortVertices( intVertices, sortVertices, grid );

    this.reIndexIndices( sortVertices, indices, newIndices );
    this.reArrangeTriangles( newIndices );

    var deltaIndices = new Int32Array( indices.length );
    deltaIndices.set(newIndices);

    this.makeIndexDeltas( deltaIndices );

    if( normals !== undefined ) {
      var intNormals = new Int32Array( 2 * numVertices );
      if( useSmoothNormals === true ) {
        var restoredVertices = new Float32Array( positions.length );
        this.deQuantizePositions( intVertices, restoredVertices, grid );
        this.makeNormalDeltasRelativeToSmoothNormals( normals, intNormals, restoredVertices, newIndices, sortVertices, quantizedBitsNormals );
      }
      else {
        this.quantizeNormals( normals, intNormals, sortVertices, quantizedBitsNormals );
        this.applyDeltaTransform( intNormals, 2 );
      }
    }

    if( uvs !== undefined ) {
      var intUVs = new Int16Array( 2 * numVertices );
      this.quantizeUVs( uvs, intUVs, sortVertices, quantizedBitsUVs );
      this.applyDeltaTransform( intUVs, 2 );
    }

    this.applyDeltaTransform( intVertices, 3 );

    var encodedBuffer = { grid, intVertices, intNormals, intUVs };
    encodedBuffer.deltaIndices = deltaIndices;
    encodedBuffer.useSmoothNormals = (useSmoothNormals === true);
    encodedBuffer.hasIndices = hasIndices;
    encodedBuffer.quantizedBitsPositions = quantizedBitsPositions;
    encodedBuffer.quantizedBitsNormals = quantizedBitsNormals;
    encodedBuffer.quantizedBitsUVs = quantizedBitsUVs;

    return encodedBuffer;
  },

  decodeData: function( encodedBuffer ) {
    var vertices = new Float32Array( encodedBuffer.intVertices.length );
    var normals = new Float32Array( encodedBuffer.intVertices.length );
    var numVertices = Math.floor( encodedBuffer.intVertices.length /3);
    var uvs = new Float32Array( numVertices * 2 );

    this.invertDeltaTransform( encodedBuffer.intVertices, 3 );

    if(encodedBuffer.useSmoothNormals === false ) {
      if(encodedBuffer.intNormals !== undefined)
        this.invertDeltaTransform( encodedBuffer.intNormals, 2 );
    }

    if(encodedBuffer.intUVs !== undefined)
      this.invertDeltaTransform( encodedBuffer.intUVs, 2 );

    var indices = new Int32Array( encodedBuffer.deltaIndices.length );
    indices.set(encodedBuffer.deltaIndices);

    this.restoreIndices( indices );

    if( encodedBuffer.hasIndices === false ) {
      this.restoreDataOrder( encodedBuffer.intVertices, indices, 3 );

      if(encodedBuffer.intNormals !== undefined)
        this.restoreDataOrder( encodedBuffer.intNormals, indices, 2 );

      if(encodedBuffer.intUVs !== undefined)
        this.restoreDataOrder( encodedBuffer.intUVs, indices, 2 );
    }

    this.deQuantizePositions( encodedBuffer.intVertices, vertices, encodedBuffer.grid );

    if(encodedBuffer.intNormals !== undefined) {
      if( encodedBuffer.useSmoothNormals === true ) {
        var tempIndices = encodedBuffer.hasIndices ? indices : this.createDummyIndices( indices.length );
        this.restoreNormalsRelativeToSmoothNormals(encodedBuffer.intNormals, normals, vertices, tempIndices, encodedBuffer.quantizedBitsNormals );
      }
      else {
        this.deQuantizeNormals( encodedBuffer.intNormals, normals, encodedBuffer.quantizedBitsNormals );
      }
    }

    if(encodedBuffer.intUVs !== undefined)
      this.deQuantizeUVs( encodedBuffer.intUVs, uvs, encodedBuffer.quantizedBitsUVs );

    var decodedBuffer = {vertices, normals, uvs, indices};
    return decodedBuffer;
  }

}

// THREE.SimpleEncoder = function() {
//   this.encodingDecodingUtility = new THREE.EncodingDecodingUtility();
// }

// THREE.SimpleEncoder.prototype = {
//   constructor: THREE.SimpleEncoder,
//
//   encode: function( dataContainer, options ) {
//     var grid = new THREE.Grid();
//     options = options || {};
//     var quantizedBits = options.quantizedBits ? options.quantizedBits : 16;
//
//     this.encodingDecodingUtility.setupQuantizedGrid( buffer, grid, quantizedBits);
//
//     var intVertices = new Int16Array( buffer.length );
//     var positionBuffer = dataContainer.getPositionBuffer();
//     this.encodingDecodingUtility.quantize( buffer, intVertices, grid );
//     if( options.deltaTransform )
//       this.encodingDecodingUtility.applyDeltaTransform( intVertices );
//     dataContainer.setPositionBuffer( intVertices );
//
//     var normalBuffer = dataContainer.getNormalBuffer();
//     this.encodingDecodingUtility.encodeDirections(normalBuffer, quantizedBits);
//     dataContainer.setNormalBuffer( 0 );
//     // return intVertices;
//   }
// };
//
// THREE.SimpleDecoder = function() {
//   this.encodingDecodingUtility = new THREE.EncodingDecodingUtility();
// }

// THREE.SimpleDecoder.prototype = {
//   constructor: THREE.SimpleDecoder,
//
//   decode: function( encodedObject ) {
//     var decodedBuffer = new Float32Array( encodedObject.quantizedData.length );
//     this.encodingDecodingUtility.invertDeltaTransform( encodedObject.intVertices );
//     this.encodingDecodingUtility.deQuantize( encodedBuffer.intVertices, decodedBuffer, encodedObject.grid );
//     return decodedBuffer;
//   }
// };

// THREE.Encoding = function() {
//   this.encoder = new THREE.SimpleEncoder();
//   this.decoder = new THREE.Decoder();
// }

// THREE.Encoding.prototype = {
//   constructor: THREE.Encoding
//
//   getEncoder: function() {
//     return this.encoder;
//   },
//
//   getDecoder: function() {
//     return this.decoder;
//   }
// }
