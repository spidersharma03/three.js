float smoothDistanceAtt ( float squaredDistance , float invSqrAttRadius )
2 {
3 float factor = squaredDistance * invSqrAttRadius ;
4 float smoothFactor = saturate (1.0 f - factor * factor );
5 return smoothFactor * smoothFactor ;
6 }
7
8 float getDistanceAtt ( float3 unormalizedLightVector , float invSqrAttRadius )
9 {
10 float sqrDist = dot ( unormalizedLightVector , unormalizedLightVector );
11 float attenuation = 1.0 / (max ( sqrDist , 0.01*0.01) );
12 attenuation *= smoothDistanceAtt ( sqrDist , invSqrAttRadius );
13
14 return attenuation ;
15 }
16
17 float getAngleAtt ( float3 normalizedLightVector , float3 lightDir ,
18 float lightAngleScale , float lightAngleOffset )
19 {
20 // On the CPU
21 // float lightAngleScale = 1.0 f / max (0.001f, ( cosInner - cosOuter ));
22 // float lightAngleOffset = -cosOuter * angleScale ;
23
24 float cd = dot ( lightDir , normalizedLightVector );
25 float attenuation = saturate ( cd * lightAngleScale + lightAngleOffset ) ;
26 // smooth the transition
27 attenuation *= attenuation ;
28
29 return attenuation ;
30 }
31
32 // Process punctual light
33 float3 unnormalizedLightVector = lightPos - worldPos ;
34 float3 L = normalize ( unnormalizedLightVector ) ;
35
36 float att = 1;
37 att *= getDistanceAtt ( unormalizedLightVector , lightInvSqrAttRadius );
38 att *= getAngleAtt (L , lightForward , lightAngleScale , lightAngleOffset );
39
40 float3 luminance = BSDF (...) * saturate ( dot (N , L)) * lightColor * att ;
