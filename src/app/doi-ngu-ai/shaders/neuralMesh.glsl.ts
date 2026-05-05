export const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 displaced = position;
  float n = hash(position * 1.5 + uTime * 0.15);
  displaced += normal * (n - 0.5) * 0.18;

  vNormal = normalize(normalMatrix * normal);
  vPosition = displaced;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
  vec3 grad = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vPosition.y * 1.3 + uTime * 0.6));
  vec3 color = grad * (0.4 + fresnel * 1.6);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.8);
  gl_FragColor = vec4(color * pulse, 1.0);
}
`;
