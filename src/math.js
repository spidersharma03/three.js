
import { Vector2 } from './math/Vector2.js';
import { Vector3 } from './math/Vector3.js';
import { Color } from './math/Color.js';
import { Quaternion } from './math/Quaternion.js';
import { Matrix3 } from './math/Matrix3.js';
import { Matrix4 } from './math/Matrix4.js';

export { Box3 } from './math/Box3.js';
export { Matrix4 };
export { Matrix3 };
export { Vector2 }
export { Vector3 };
export { Quaternion };
export { Color };
export { Euler } from './math/Euler.js';
export { _Math as Math } from './math/Math.js';


// camera
export { Ray } from './math/Ray.js';
export { Spherical } from './math/Spherical.js';
export { Sphere } from './math/Sphere.js';
export { Plane } from './math/Plane.js';

export * from './constants.js';

Vector2.InstanceScalarSize = 2;
Vector3.InstanceScalarSize = 3;
//Vector4.InstanceScalarSize = 4;

Color.InstanceScalarSize = 3;
Quaternion.InstanceScalarSize = 4;

Matrix3.InstanceScalarSize = 9;
Matrix4.InstanceScalarSize = 16;

