'use strict';
var got = require('got');
var registryUrl = require('registry-url');
var Promise = require('pinkie-promise');

module.exports = function (name, version) {
	if (typeof name !== 'string') {
		return Promise.reject(new Error('package name required'));
	}

	return got(registryUrl + name.toLowerCase())
		.then(function (data) {
			var versionName = '';
			var versionDate = '';
			var versionToCheck = '';
			var latestVersion = '';
			var latestDate = '';
			var description = '';
			var license = '';
			var homepage = '';
			var authorName = '';

			var dataParsed = JSON.parse(data.body);

			latestVersion = dataParsed['dist-tags'].latest;

			versionToCheck = version || latestVersion;

			if (dataParsed.versions[versionToCheck] == null) {
				throw new Error('Version \'' + versionToCheck + '\' for \'' + name + '\' doesn\'t exist');
			}

			var pkgInfo = dataParsed.versions[versionToCheck];

			versionName = pkgInfo.name;
			description = pkgInfo.description;
			license = pkgInfo.license;
			latestDate = dataParsed.time[latestVersion];
			versionDate = dataParsed.time[versionToCheck];

			if (pkgInfo.homepage !== undefined) {
				homepage = pkgInfo.homepage;
			}

			if (pkgInfo.author !== undefined) {
				authorName = pkgInfo.author.name;
			} else {
				if (pkgInfo.maintainers !== undefined) {
					for (var i in pkgInfo.maintainers) {
						var maintainer = pkgInfo.maintainers[i];
						if (authorName === '') {
							authorName = maintainer.name;
						} else {
							authorName = authorName + ', ' + maintainer.name;
						}
					}
				}
			}

			return {
				name: versionName,
				latestDate: latestDate,
				latestVersion: latestVersion,
				version: versionToCheck,
				versionDate: versionDate,
				description: description,
				license: license,
				homepage: homepage,
				author: authorName
			};
		})
		.catch(function (err) {
			if (err.statusCode === 404) {
				err.message = name + ' Package doesn\'t exist';
			}

			throw err;
		});
};
