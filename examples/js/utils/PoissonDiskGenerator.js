function PopRandom( Points )
{
	var Idx = Math.floor(Math.random() * Points.length);
  if( Idx > Points.length )
    console.error("IDX > LENGTH");
	var P = Points[ Idx ];
	Points.splice( Idx, 1 );
	return P;
}

function isInCircle( x, y ) {
  var fx = x - 0.5;
  var fy = y - 0.5;
  return ( fx*fx + fy*fy ) <= 0.25;
}

function isInRect( x, y) {
	return x >= 0 && y >= 0 && x <= 1 && y <= 1;
}

function Grid( width, height, cellSize ) {
  this.width = width;
  this.height = height;
  this.cellSize = cellSize;
  this.gridArray = new Array(width);
  for( var i=0; i<width; i++) {
    this.gridArray[i] = new Array(height);
  }
}

Grid.prototype = {
  constructor: Grid,

  insert: function( P )
	{
		var Gx = Math.floor(P.x / this.cellSize);
    var Gy = Math.floor(P.y / this.cellSize);
		this.gridArray[ Gx ][ Gy ] = P;
	},

	isInNeighbourhood: function( Point, MinDist, CellSize )
	{
    var Gx = Math.floor(Point.x / this.cellSize);
    var Gy = Math.floor(Point.y / this.cellSize);
		// number of adjucent cells to look for neighbour points
		var D = 5;

		// scan the neighbourhood of the point in the grid
		for ( var i = Gx - D; i < Gx + D; i++ )
		{
			for ( var j = Gy - D; j < Gy + D; j++ )
			{
				if ( i >= 0 && i < this.width && j >= 0 && j < this.height )
				{
					var P = this.gridArray[ i ][ j ];
          var distance = 1e10;
          if( P !== undefined ) {
            distance = P.distanceTo(Point);
          }
					if ( distance < MinDist )
              return true;
				}
			}
		}


		return false;
	}

}

function PoissonDiskGenerator( numPoints, minDistance, bUseDistribution, bCircle ) {
  this.numPoints = numPoints === undefined ? 30 : numPoints;
  this.minDistance = minDistance === undefined ? -1 : minDistance;
	this.bUseDistribution = (bUseDistribution === undefined) ? false : bUseDistribution;
	this.bCircleTest = (bCircle === undefined) ? false : bCircle;
}

PoissonDiskGenerator.prototype = {
  constructor: PoissonDiskGenerator,

  generateRandomPointAround: function( Pin, minDist )
  {
  	// start with non-uniform distribution
  	var R1 = Math.random();
    var R2 = Math.random();

  	// radius should be between MinDist and 2 * MinDist
  	var Radius = minDist * ( R1 + 1.0 );

  	// random angle
  	var Angle = 2 * 3.141592653589 * R2;

  	// the new point is generated around the point (x, y)
  	var X = Pin.x + Radius * Math.cos( Angle );
  	var Y = Pin.y + Radius * Math.sin( Angle );
    var Pout = new THREE.Vector2(X, Y)
  	return Pout;
  },

  generatePoints: function() {
    if ( this.minDistance < 0.0 )
  	{
  		this.minDistance = Math.sqrt( this.numPoints) / this.numPoints;
  	}
    var SamplePoints = [];
  	var ProcessList = [];

  	// create the grid
  	var CellSize = this.minDistance / Math.sqrt( 2.0 );

  	var GridW = Math.ceil( 1.0 / CellSize );
  	var GridH = Math.ceil( 1.0 / CellSize );

  	var grid = new Grid( GridW, GridH, CellSize );

  	var FirstPoint = new THREE.Vector2(0.5,0.5);
    var inCircle = false;
    do {
  		FirstPoint.x = Math.random();
      FirstPoint.y = Math.random();
      inCircle = this.bCircleTest ? isInCircle(FirstPoint.x, FirstPoint.y) : isInRect(FirstPoint.x, FirstPoint.y);
  	} while (!inCircle);

    // update containers
  	ProcessList.push( FirstPoint );
  	SamplePoints.push( FirstPoint );
  	grid.insert( FirstPoint );
    var NewPointsCount = 30;
    // generate new points for each point in the queue
  	while ( (ProcessList.length !== 0) && (SamplePoints.length < this.numPoints) )
  	{
  		var Point = PopRandom( ProcessList );

  		for ( var i = 0; i < NewPointsCount; i++ )
  		{
        var dx = Point.x - 0.5; var dy = Point.y - 0.5;
        var distance = Math.sqrt( dx * dx + dy * dy);
        var t = Math.sqrt(distance * distance);
        var minVal = 0.45; var maxVal = 8;
        var fraction = minVal * ( 1.0 - t) + maxVal * t;
				fraction = this.bUseDistribution ? fraction : 1.0;
  			var NewPoint = this.generateRandomPointAround( Point, fraction * this.minDistance );

				var inCircle = this.bCircleTest ? isInCircle(NewPoint.x, NewPoint.y) : isInRect(NewPoint.x, NewPoint.y);

  			if ( inCircle && !grid.isInNeighbourhood( NewPoint, fraction * this.minDistance, CellSize ) )
  			{
  				ProcessList.push( NewPoint );
  				SamplePoints.push( NewPoint );
  				grid.insert( NewPoint );
  				continue;
  			}
  		}
  	}

    return SamplePoints;
  },

  testSamples: function( SamplePoints ) {
    for( var i=0; i<SamplePoints.length; i++) {
      var point1 = SamplePoints[i];
      for( var j=0; j<SamplePoints.length; j++) {
        if(i === j)
          continue;
        var point2 = SamplePoints[j];
        var distance = point1.distanceTo(point2);
        if(distance < this.minDistance) {
          console.error("ERROR IN SAMPLE DISTANCES");
        }
      }
    }
  },

  shuffle: function(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  },

  createDataTexture: function( SamplePoints ) {
    SamplePoints = this.shuffle(SamplePoints);
    var floatArray = new Float32Array(SamplePoints.length * 2);
    for( var i=0; i<2*(SamplePoints.length); i+=2) {
      floatArray[i]   = SamplePoints[i/2].x - 0.5;
      floatArray[i+1] = SamplePoints[i/2].y - 0.5;
			// floatArray[i]   = THREE.toHalf(SamplePoints[i/2].x - 0.5);
      // floatArray[i+1] = THREE.toHalf(SamplePoints[i/2].y - 0.5);
    }
    var dataTexture = new THREE.DataTexture(floatArray, SamplePoints.length, 1);
    dataTexture.format = THREE.LuminanceAlphaFormat;
    dataTexture.type = THREE.FloatType;
    dataTexture.minFilter = THREE.NearestFilter;
    dataTexture.magFilter = THREE.NearestFilter;
    dataTexture.generateMipmaps = false;
    dataTexture.needsUpdate = true;
    return dataTexture;
  }

}
