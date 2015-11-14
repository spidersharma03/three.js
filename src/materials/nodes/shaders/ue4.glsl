http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf


Theoretical Approach

float3 ImportanceSampleGGX( float2 Xi, float Roughness, float3 N )
{
float a = Roughness * Roughness;
float Phi = 2 * PI * Xi.x;
float CosTheta = sqrt( (1 - Xi.y) / ( 1 + (a*a - 1) * Xi.y ) );
float SinTheta = sqrt( 1 - CosTheta * CosTheta );
float3 H;
H.x = SinTheta * cos( Phi );
H.y = SinTheta * sin( Phi );
H.z = CosTheta;
float3 UpVector = abs(N.z) < 0.999 ? float3(0,0,1) : float3(1,0,0);
float3 TangentX = normalize( cross( UpVector, N ) );
float3 TangentY = cross( N, TangentX );
// Tangent to world space
return TangentX * H.x + TangentY * H.y + N * H.z;
}
float3 SpecularIBL( float3 SpecularColor , float Roughness, float3 N, float3 V )
{
float3 SpecularLighting = 0;
const uint NumSamples = 1024;
for( uint i = 0; i < NumSamples; i++ )
{
float2 Xi = Hammersley( i, NumSamples );
4
float3 H = ImportanceSampleGGX( Xi, Roughness, N );
float3 L = 2 * dot( V, H ) * H - V;
float NoV = saturate( dot( N, V ) );
float NoL = saturate( dot( N, L ) );
float NoH = saturate( dot( N, H ) );
float VoH = saturate( dot( V, H ) );
if( NoL > 0 )
{
float3 SampleColor = EnvMap.SampleLevel( EnvMapSampler , L, 0 ).rgb;
float G = G_Smith( Roughness, NoV, NoL );
float Fc = pow( 1 - VoH, 5 );
float3 F = (1 - Fc) * SpecularColor + Fc;
// Incident light = SampleColor * NoL
// Microfacet specular = D*G*F / (4*NoL*NoV)
// pdf = D * NoH / (4 * VoH)
SpecularLighting += SampleColor * F * G * VoH / (NoH * NoV);
}
}
return SpecularLighting / NumSamples;
}


Optimization via Prefiltered

float3 PrefilterEnvMap( float Roughness, float3 R )
{
float3 N = R;
float3 V = R;
float3 PrefilteredColor = 0;
const uint NumSamples = 1024;
for( uint i = 0; i < NumSamples; i++ )
{
float2 Xi = Hammersley( i, NumSamples );
float3 H = ImportanceSampleGGX( Xi, Roughness, N );
float3 L = 2 * dot( V, H ) * H - V;
float NoL = saturate( dot( N, L ) );
if( NoL > 0 )
{
PrefilteredColor += EnvMap.SampleLevel( EnvMapSampler , L, 0 ).rgb * NoL;
TotalWeight += NoL;
}
}
return PrefilteredColor / TotalWeight;
}


Environmental BRDF

float2 IntegrateBRDF( float Roughness, float NoV )
{
float3 V;
V.x = sqrt( 1.0f - NoV * NoV ); // sin
V.y = 0;
V.z = NoV; // cos
float A = 0;
float B = 0;
const uint NumSamples = 1024;
for( uint i = 0; i < NumSamples; i++ )
{
float2 Xi = Hammersley( i, NumSamples );
float3 H = ImportanceSampleGGX( Xi, Roughness, N );
float3 L = 2 * dot( V, H ) * H - V;
float NoL = saturate( L.z );
float NoH = saturate( H.z );
float VoH = saturate( dot( V, H ) );
if( NoL > 0 )
{
float G = G_Smith( Roughness, NoV, NoL );
float G_Vis = G * VoH / (NoH * NoV);
float Fc = pow( 1 - VoH, 5 );
A += (1 - Fc) * G_Vis;
B += Fc * G_Vis;
}
}
return float2( A, B ) / NumSamples;
}

Approximation

float3 ApproximateSpecularIBL( float3 SpecularColor , float Roughness, float3 N, float3 V )
{
float NoV = saturate( dot( N, V ) );
float3 R = 2 * dot( V, N ) * N - V;
float3 PrefilteredColor = PrefilterEnvMap( Roughness, R );
float2 EnvBRDF = IntegrateBRDF( Roughness, NoV );
return PrefilteredColor * ( SpecularColor * EnvBRDF.x + EnvBRDF.y );
}
