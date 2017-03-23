#define PI 3.14159265359
#define PI2 6.28318530718
#define PI_HALF 1.5707963267949
#define RECIPROCAL_PI 0.31830988618
#define RECIPROCAL_PI2 0.15915494
#define LOG2 1.442695
#define EPSILON 1e-6

#define saturate(a) clamp( a, 0.0, 1.0 )
#define whiteCompliment(a) ( 1.0 - saturate( a ) )

float pow2( const in float x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }
// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.
// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};

struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};

struct GeometricContext {
	vec3 position;
	vec3 normal;
	vec3 viewDir;
};

vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

}

// http://en.wikibooks.org/wiki/GLSL_Programming/Applying_Matrix_Transformations
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {

	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );

}

vec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {

	float distance = dot( planeNormal, point - pointOnPlane );

	return - distance * planeNormal + point;

}

float sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {

	return sign( dot( point - pointOnPlane, planeNormal ) );

}

vec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {

	return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;

}

mat3 transpose( const in mat3 v ) {

	mat3 tmp;
	tmp[0] = vec3(v[0].x, v[1].x, v[2].x);
	tmp[1] = vec3(v[0].y, v[1].y, v[2].y);
	tmp[2] = vec3(v[0].z, v[1].z, v[2].z);

	return tmp;

}

float rectangleSolidAngle ( vec3 worldPos ,vec3 p0 , vec3 p1 , vec3 p2 , vec3 p3 ) {
 vec3 v0 = p0 - worldPos ;
 vec3 v1 = p1 - worldPos ;
 vec3 v2 = p2 - worldPos ;
 vec3 v3 = p3 - worldPos ;
 vec3 n0 = normalize ( cross (v0 , v1 ));
 vec3 n1 = normalize ( cross (v1 , v2 ));
 vec3 n2 = normalize ( cross (v2 , v3 ));
 vec3 n3 = normalize ( cross (v3 , v0 ));

 float g0 = acos ( dot (-n0 , n1 ));
 float g1 = acos ( dot (-n1 , n2 ));
 float g2 = acos ( dot (-n2 , n3 ));
 float g3 = acos ( dot (-n3 , n0 ));

 return g0 + g1 + g2 + g3 - 2.0 * PI ;
}

float rightPyramidSolidAngle ( float dist , float halfWidth , float halfHeight ) {
 float a = halfWidth ;
 float b = halfHeight ;
 float h = dist ;
 return 4.0 * asin (a * b / sqrt (( a * a + h * h) * (b * b + h * h) ));
}

vec3 rayPlaneIntersect (in vec3 rayOrigin , in vec3 rayDirection , in vec3 planeOrigin , in vec3 planeNormal ) {
 float distance = dot ( planeNormal , planeOrigin - rayOrigin ) / dot ( planeNormal , rayDirection );
 return rayOrigin + rayDirection * distance ;
}

vec3 closestPointRect (in vec3 pos , in vec3 planeOrigin , in vec3 left , in vec3 up , in float halfWidth , in float halfHeight ) {

	vec3 dir = pos - planeOrigin ;
 // - Project in 2D plane ( forward is the light direction away from
 // the plane )
 // - Clamp inside the rectangle
 // - Calculate new world position
 vec2 dist2D = vec2 (dot ( dir , left ) , dot ( dir , up ));
 vec2 rectHalfSize = vec2 ( halfWidth , halfHeight ) ;
 dist2D = clamp ( dist2D , - rectHalfSize , rectHalfSize );
 return planeOrigin + dist2D .x * left + dist2D .y * up ;
}

// returns distance on the ray to the object if hit, 0 otherwise
float Trace_plane(vec3 o, vec3 d, vec3 planeOrigin, vec3 planeNormal)
{
	return dot(planeNormal, (planeOrigin - o) / dot(planeNormal, d));
}

// o		: ray origin
// d		: ray direction
// A,B,C	: traingle corners
// returns distance on the ray to the object if hit, 0 otherwise
float Trace_triangle(vec3 o, vec3 d, vec3 A, vec3 B, vec3 C)
{
	vec3 planeNormal = normalize(cross(B - A, C - B));
	float t = Trace_plane(o, d, A, planeNormal);
	vec3 p = o + d*t;

	vec3 N1 = normalize(cross(B - A, p - B));
	vec3 N2 = normalize(cross(C - B, p - C));
	vec3 N3 = normalize(cross(A - C, p - A));

	float d0 = dot(N1, N2);
	float d1 = dot(N2, N3);

	float threshold = 1.0 - 0.001;
	return (d0 > threshold && d1 > threshold) ? 1.0 : 0.0;
}
// o		: ray origin
// d		: ray direction
// A,B,C,D	: rectangle corners
// returns distance on the ray to the object if hit, 0 otherwise
float Trace_rectangle(vec3 o, vec3 d, vec3 A, vec3 B, vec3 C, vec3 D)
{
	return max(Trace_triangle(o, d, A, B, C), Trace_triangle(o, d, C, D, A));
}

vec3 ClosestPointOnSegment(vec3 a, vec3 b, vec3 c)
{
	vec3 ab = b - a;
	float t = dot(c - a, ab) / dot(ab, ab);
	return a + clamp(t, 0.0, 1.0) * ab;
}

vec3 ClosestPointOnLine(vec3 a, vec3 b, vec3 c)
{
	vec3 ab = b - a;
	float t = dot(c - a, ab) / dot(ab, ab);
	return a + t * ab;
}
