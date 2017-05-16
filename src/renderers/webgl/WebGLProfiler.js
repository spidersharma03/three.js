THREE.WebGLProfiler = function( renderer ) {
  this.gl = renderer.getContext();
  this.ext = this.gl.getExtension('EXT_disjoint_timer_query');
  if( this.ext === undefined ) {
    console.warn("WebGLProfiler::EXT_disjoint_timer_query is not supported!")
  } else {
    this.query = this.ext.createQueryEXT();
  }
  this.dirty = false;
}

THREE.WebGLProfiler.prototype = {
  constructor : THREE.WebGLProfiler,

  start: function() {
    if( this.ext !== undefined && !this.dirty ) {
      this.ext.beginQueryEXT(this.ext.TIME_ELAPSED_EXT, this.query);
    }
  },

  end: function() {
    if( this.ext !== undefined && !this.dirty )
      this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
    this.dirty = true;
  },

  available: function() {
    if( this.ext !== undefined ) {
      var result = this.ext.getQueryObjectEXT(this.query, this.ext.QUERY_RESULT_AVAILABLE_EXT);
      return result;
    }
  },

  value: function() {
    if( this.ext !== undefined ) {
      var disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);

      if ( !disjoint) {
        var timeElapsed = this.ext.getQueryObjectEXT(this.query, this.ext.QUERY_RESULT_EXT) * 0.000001;
        this.dirty = false;
      }
      return timeElapsed;
    }
  }
}
