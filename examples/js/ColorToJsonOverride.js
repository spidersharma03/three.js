//override the toJSON function to return serialization to its previous state
THREE.Color.prototype.toJSON = function() {
  return { r: this.r, g: this.g, b: this.b };
}
