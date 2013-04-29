/**
 * @author bhouston / http://exocortex.com
 */

THREE.Progress = function ( tasks, progressCallback ) {

	if( this.tasks <= 0 ) {
		console.warn( "tasks must be greater than 0.")
	}

	this.tasks = tasks || 100;
	this.currentTask = 0;
	this.childProgress = null;
	this.parent = null;
	this.callback = progressCallback;

};

THREE.Progress.prototype = {

	constructor: THREE.Progress,

	next: function () {

		if( this.childProgress !== null ) {
			console.warn( "this.childProgress is not null, can not this.next() until child progress is completed.")
		}

		if( this.currentTask >= this.tasks ) {
			console.warn( "this.next() is meaningless, this.currentTask >= this.tasks.")
		}

		this.currentIncrement ++;
		if( this.currentTask == this.tasks ) {
			this.complete();
		}		

	},

	complete: function() {
		// force this progress to be complete if it isn't.
		this.currentTask = this.tasks;

		if( this.parentProgress !== null ) {
			if( this.parentProgress !== this.parentProgress.childProgress ) {
				console.warn( "Parent Progress doesn't have a proper reference to Child Progress")
			}
			this.parentProgress.childProgress = null;
			this.parentProgress.next();
			this.parent = null;
		}

	},

	createChildProgress: function( childTasks ) {

		if( this.childProgress !== null ) {
			console.warn( "this.childProgress is not null, can not create another child progress until current is completed.")
		}

		this.childProgress = new THREE.Progress( childTasks );
		this.childProgress.parentProgress = this.childProgress;

		return child;

	},

	// reporting functions

	isComplete: function() {

		return ( this.currentTask >= this.tasks );

	},

	remainingTasks: function() {

		return this.tasks - this.currentTask;

	},

	getFraction: function () {

		var task = this.currentTask;
		var inverseTasks = 1.0 / this.tasks;
		if( this.childProgress ) {
			task += childProgress.getFraction() * inverseTasks;
		}

		return Math.min( task  * inverseTasks, 1.0 );

	},

	getPercentage: function () {
	
		return this.getFraction() * 100;

	}

};
