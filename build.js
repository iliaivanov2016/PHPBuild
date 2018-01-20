/*
run from source folder:

/home/leo/node.js/php_build/build.js build.json


node /home/leo/node.js/php_build/build.js /windows/modcoding/gravity_forms_mc_unique_id_generator/1.30/versions.json

replacement version directives:
1) PHP
#IFVER <VERSION_NAME>
...
#ENDIF
#IFNVER <VERSION_NAME>
 ...
#ENDIF
#IFVER NONE
 ...
#ENDIF

2) Javascript
// #IFVER <VERSION_NAME>
 ...
// #ENDIF
// #IFNVER <VERSION_NAME>
 ...
// #ENDIF
// #IFVER NONE
 ...
// #ENDIF

3) CSS (remove '// ' from beginning)
*/
// /* #IFVER <VERSION_NAME> */
//...
// /* #ENDIF */
// /* #IFNVER <VERSION_NAME> */
// ...
// /* #ENDIF */
// /* #IFVER NONE */
// ...
// /* #ENDIF */


////////////////////////////////////////////////// modules /////////////////////////////////////////////////////////////
var Promise = require("bluebird");
var fs = require("fs");
var path = require("path");
var exec = require('child_process').exec;
var rimraf = require('rimraf');
var glob = require("glob");
var ncp = require('ncp').ncp;
ncp.limit = 10;
const compile = require('google-closure-compiler-js').compile;
var CleanCSS = require('clean-css');
var winston = require('winston');

////////////////////////////////////////////////// variables ///////////////////////////////////////////////////////////
if (process.argv.length != 3) throw new Error("Error - invalid number of arguments = " + process.argv.length);
var versions_file = process.argv[2].toString();
var base_dir = path.dirname(versions_file);
try { fs.unlinkSync(path.join(base_dir, "log.txt"))} catch(e){};
try { fs.unlinkSync(path.join(base_dir, "errors.txt"))} catch(e){};
var versions_config = null;
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.File)({
			name:     'info-file',
			filename: path.join(base_dir, 'log.txt'),
			maxsize:	10*1024*1024,
			maxFiles: 1,
			level:    'info',
			json:     false
		}),
		new (winston.transports.File)({
			name:                                     'error-file',
			filename: 																path.join(base_dir, 'errors.txt'),
			handleExceptions:                         true,
			humanReadableUnhandledException:          true,
			level:                                    'error',
			json:                                     false
		})
	]
});

///////////////////////////////////////////////////// functions ////////////////////////////////////////////////////////


Promise.promisifyAll(fs);
logger.info("base_dir = " + base_dir);

function FileDelete(dest_dir,param){
	var fn = path.join(dest_dir, param.toString());
logger.info("FileDelete "+fn);
	if (fn.indexOf("*") >= 0) {
		glob(fn, [], function (er, files) {
			// files is an array of filenames.
			// If the `nonull` option is set, and nothing
			// was found, then files is ["**/*.js"]
			// er is an error object or null.
logger.info(files);
			return Promise.map(files, function(filename){
logger.info("DELETE FILE "+filename);
				try { fs.unlinkSync(filename); } catch(e) {};
			}, {concurrency: 5});
		});
	} else {
logger.info("DELETE FILE "+fn);
		try { fs.unlinkSync(fn); } catch(e) {};
		return true;
	}
}

function FileRename(dest_dir,param){
logger.info("FileRename ",param);
	try {
		var old_fn = path.join(dest_dir, param[0]);
		var new_fn = path.join(dest_dir, param[1]);
		fs.renameSync(old_fn, new_fn);
		return true;
	} catch (e){
logger.error("Error renaming ",param+"\n"+e.message);
		return false;
	}
}

function ProcessReplace(version_name, filename){
	var contents = fs.readFileSync(filename, "utf8").toString();
logger.info(">ProcessReplace " + filename +"\nlen = "+contents.length+"\nversion = " + version_name);
	var tag_1, tag2, p1, p2, p3, p4, len, tl1, tl2, src, dest, ver;

	// replace existing blocks IFVER version_name
	tag_1 = "#IFVER";
	tag_2 = "#ENDIF";
logger.info("0.1.ProcessReplace " + filename +"\nlen = "+contents.length+"\n"+tag_1+"\n"+tag_2);

	if (filename.toString().indexOf(".js") >= 0) {
		tag_1 = "//" + tag_1;
		tag_2 = "//" + tag_2;
	} else
	if (filename.toString().indexOf(".css") >= 0) {
		tag_1 = "/* " + tag_1;
		tag_2 = "/* " + tag_2;
	}
	tl1 = tag_1.length;
	tl2 = tag_2.length;
logger.info("1.0.ProcessReplace tag_1 = "+tag_1+" tag_2 = "+tag_2+" tl1 = "+tl1+" tl2 = "+tl2);
logger.info("p1 = " + contents.indexOf(tag_1));
//	var n = 0;
	while ( (p1 = contents.indexOf(tag_1)) >= 0) {
		p3 = contents.indexOf("\n", p1 + tl1) + 1;
		p2 = contents.indexOf(tag_2, (p1 + tl1));
logger.info("1.1.ProcessReplace tag_1 = "+tag_1+" tag_2 = "+tag_2+" p1 = "+p1+" p2 = " + p2 +" p3 = "+p3);
		if ( (p3 < 0) || (p2 < 0) )
			break;
		ver = contents.substr(p1, p3 - p1).trim();
		p4 = contents.indexOf("\n", p2 + tl2) + 1;
logger.info("1.2.ProcessReplace tag_1 = "+tag_1+" tag_2 = "+tag_2+" ver = "+ver+" p1 = "+p1+" p2 = " + p2 +" p3 = "+p3+" p4 = "+p4);
		src = contents.substr(p1, p4 - p1);
		if (ver.indexOf(version_name) >= 0) {
			dest = contents.substr(p3, p2 - p3);
		} else {
			dest = "";
		}
logger.info("SRC:\n======================\n"+src);
logger.info("DEST:\n======================\n"+dest);
		contents = contents.replace(src, dest);
//if (n > 10) return;
//		n++;
	}
logger.info("<ProcessReplace " + filename +"\nlen = "+contents.length);
	fs.writeFileSync(filename, contents, "utf8");
}

function FileReplace(version_name,dest_dir,param){
	var fn = path.join(dest_dir, param.toString());
logger.info("FileReplace "+fn+" name = "+version_name);
	if (fn.indexOf("*") >= 0) {
logger.info("1.FileReplace "+fn);
		glob(fn, [], function (er, files) {
			// files is an array of filenames.
			// If the `nonull` option is set, and nothing
			// was found, then files is ["**/*.js"]
			// er is an error object or null.
logger.info(files);
			return Promise.map(files, function(filename){
logger.info("REPLACE FILE "+filename);
				return ProcessReplace(version_name, filename);
			}, {concurrency: 5});
		});
	} else {
logger.info("REPLACE FILE "+fn);
		return ProcessReplace(version_name, fn);
	}
}

function ProcessMinifyJS(filename) {
	var contents = fs.readFileSync(filename, "utf8").toString();
logger.info("ProcessMinifyJS " + filename + "\nlen = " + contents.length);
	var compressed_js = compile(
		{
			jsCode: [{src: contents}]
		}
	).compiledCode;
	fs.writeFileSync(filename.toString().replace(".js","-full.js"),contents,"utf8");
	fs.writeFileSync(filename,compressed_js,"utf8");
}

function FileMinifyJS(dest_dir,param){
	var fn = path.join(dest_dir, param.toString());
	logger.info("FileMinifyJS "+fn);
	if (fn.indexOf("*") >= 0) {
		glob(fn, [], function (er, files) {
			// files is an array of filenames.
			// If the `nonull` option is set, and nothing
			// was found, then files is ["**/*.js"]
			// er is an error object or null.
			logger.info(files);
			return Promise.map(files, function(filename){
				logger.info("MINIFY JS FILE "+filename);
				return ProcessMinifyJS(filename);
			}, {concurrency: 5});
		});
	} else {
		logger.info("MINIFY JS FILE "+fn);
		return ProcessMinifyJS(fn);
	}
}

function ProcessMinifyCSS(filename) {
	var contents = fs.readFileSync(filename, "utf8").toString();
logger.info(">ProcessMinifyCSS " + filename + "\nlen = " + contents.length);
try {
	var options = {
		level: {
			1: {
				all: true
			},
			2: {
				all: true
			}
		}
	};
logger.info(options);
/*

 */
	var compressed_css = new CleanCSS(options).minify(contents).styles;
}catch(e){
	logger.info("CSS ERROR = "+e.message);
}
logger.info("<ProcessMinifyCSS " + filename + "\nlen = " + compressed_css.toString().length);
	fs.writeFileSync(filename.toString().replace(".css","-full.css"),contents,"utf8");
	fs.writeFileSync(filename,compressed_css,"utf8");
}

function FileMinifyCSS(dest_dir,param){
	var fn = path.join(dest_dir, param.toString());
	logger.info("FileMinifyCSS "+fn);
	if (fn.indexOf("*") >= 0) {
		glob(fn, [], function (er, files) {
			// files is an array of filenames.
			// If the `nonull` option is set, and nothing
			// was found, then files is ["**/*.js"]
			// er is an error object or null.
			logger.info(files);
			return Promise.map(files, function(filename){
				logger.info("MINIFY CSS FILE "+filename);
				return ProcessMinifyCSS(filename);
			}, {concurrency: 5});
		});
	} else {
		logger.info("MINIFY CSS FILE "+fn);
		return ProcessMinifyCSS(fn);
	}
}

function DirDelete(dest_dir,param){
	var fn = path.join(dest_dir, param);
logger.info("DirDelete " + fn);
	return new Promise(function (resolve, reject) {
		rimraf(fn, function () {
			resolve(true);
		});
	});
}

function Start(){
	return new Promise(function (resolve, reject) {
		logger.info("versions_file = " + versions_file);
		fs.readFile(versions_file, function (err, content) {
			if (err)
				reject(err);
			else
				resolve(content);
		});
	});
}

function Build(version){
	var version_name = version.name.toString();
logger.info(">Build "+version_name);
	var dest_dir = path.join(base_dir, version_name.toLowerCase());
	return new Promise (function (resolve, reject) {
logger.info("1.Build " + version.name + "...");
		rimraf(dest_dir, function (){
			fs.mkdir(dest_dir,0750,function (err){
				if (err)
					reject(err);
				else {
					dest_dir = path.join(dest_dir, versions_config.plugin_dir);
					fs.mkdir(dest_dir,0750,function (err){
						if (err)
							reject(err);
						else {
							var source_dir = path.join(base_dir,"source");
							ncp(source_dir, dest_dir, function (err) {
								if (err) {
									reject(err);
								}
logger.info("2.Build " + version.name + "...");
								resolve(dest_dir);
							});
						}
					});
				}
			})
		});
	}).then(function (dest_dir){
logger.info("3.Build " + version_name + " files copied to : " + dest_dir);
		return Promise.map(version.file_actions, function (action){
logger.info("4.Build " + version_name + " files copied to : ", action);
				for (var action_name in action) {
					var param = action[action_name];
					switch (action_name) {
						case "delete": 			return FileDelete(dest_dir,param);
						case "rename": 			return FileRename(dest_dir,param);
						case "replace": 		return FileReplace(version_name, dest_dir, param);
						case "minify_js": 	return FileMinifyJS(dest_dir,param);
						case "minify_css": 	return FileMinifyCSS(dest_dir,param);
					};
				};
			}, {concurrency: 5}
		);
	}).then(function(){
logger.info("5.Build "+version_name+" File actions done!");
		return Promise.map(version.dir_actions, function (action){
				logger.info(action);
				for (var action_name in action) {
					var param = action[action_name];
					switch (action_name) {
						case "delete": { DirDelete(dest_dir,param); break; }
					};
				};
			}, {concurrency: 5}
		).then(function(){
logger.info("<Build " + version_name + "... Done!");
		});
	});

}

///////////////////////////////////////////////////// main code ////////////////////////////////////////////////////////

Start().then(function(content) {
	logger.info("content = "+content);
	versions_config = JSON.parse(content);
	return versions_config;
}).then(function (){
		return Promise.map(versions_config.versions, function (version) {
logger.info("Promise.map version = "+version.name);
			return Build(version);
		}, {concurrency: 10}
	).then(function () {
		logger.info("ALL DONE!");
	});
});
