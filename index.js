"use strict";
var got = require("got");
var registryUrl = require("registry-url");
var Promise = require("pinkie-promise");

module.exports = function(name, version) {
	function guessLicenseURLs(pkgInfo, versionToCheck) {
		var repoURLs = [];
		var guessLicenseURLEndings = ["/LICENSE", "/LICENSE.md"];

		if (pkgInfo.homepage != null) {
			var repoURL = pkgInfo.homepage;
			repoURL = repoURL.replace(/.git$/, "");

			repoURLs.push(repoURL);
		}

		if (pkgInfo.repository != null && pkgInfo.repository.url != null) {
			var repoURL = pkgInfo.repository.url;
			repoURL = repoURL.replace(/.git$/, "");

			repoURLs.push(repoURL);
		}

		return repoURLs
			.map(function(x) {
				// Create guess URLs
				var repoURL = x.replace(/(git)(\+)?(ssh|https|http)/gm, "https");
				repoURL = repoURL.replace(/(git@)/gm, "") + "/tree/";

				return guessLicenseURLEndings
					.map(function(x) {
						// build guess combinations
						return [
							{
								treeLoc: versionToCheck,
								guessLicenseURLEndings: x
							},
							{
								treeLoc: "v" + versionToCheck,
								guessLicenseURLEndings: x
							}
						];
					})
					.reduce(function(prev, curr) {
						// Flatten array
						return prev.concat(curr);
					}, [])
					.map(function(x) {
						// Create guess urls
						return repoURL + x.treeLoc + x.guessLicenseURLEndings;
					});
			})
			.reduce(function(prev, curr) {
				// Flatten array
				return prev.concat(curr);
			}, [])
			.filter(function(x) {
				// Remove any without the domain of github.com
				return x.includes("github.com");
			})
			.filter(function(x, i, arr) {
				// Remove duplicates
				return arr.indexOf(x) == i;
			});
	}

	if (typeof name !== "string") {
		return Promise.reject(new Error("package name required"));
	}

	var escapedName = name.toLowerCase().replace("/", "%2f");
	var pkgNPMRegURL = registryUrl + escapedName;

	return got(pkgNPMRegURL)
		.then(async function(data) {
			var versionName = "";
			var versionDate = "";
			var versionToCheck = "";
			var latestVersion = "";
			var latestDate = "";
			var description = "";
			var license = "";
			var licenseURL = "";
			var homepage = "";
			var authorName = "";

			var dataParsed = JSON.parse(data.body);
			latestVersion = dataParsed["dist-tags"].latest;
			versionToCheck = version || latestVersion;

			if (dataParsed.versions[versionToCheck] == null) {
				throw new Error(
					"Version '" + versionToCheck + "' for '" + name + "' doesn't exist"
				);
			}

			var pkgInfo = dataParsed.versions[versionToCheck];

			versionName = pkgInfo.name;
			description = '"' + pkgInfo.description + '"';
			license = pkgInfo.license;
			latestDate = dataParsed.time[latestVersion];
			versionDate = dataParsed.time[versionToCheck];

			var guessedLicenseURLs = guessLicenseURLs(pkgInfo, versionToCheck);

			licenseURL = await Promise.all(
				guessedLicenseURLs.map(async function(guessedLicenseURL) {
					try {
						const found = await got(guessedLicenseURL);
						if (found) {
							return guessedLicenseURL;
						}
					} catch (e) {
						return;
					}
				})
			)
				.then(function(guessedLicenseURLs) {
					var licenseURLs = guessedLicenseURLs.filter(function(
						guessedLicenseURL
					) {
						return guessedLicenseURL != null;
					});

					return licenseURLs.length === 0 ? "" : licenseURLs[0];
				})
				.catch(function(x) {
					return "";
				});

			if (pkgInfo.author !== undefined) {
				authorName = pkgInfo.author.name;
			} else {
				if (pkgInfo.maintainers !== undefined) {
					for (var i in pkgInfo.maintainers) {
						var maintainer = pkgInfo.maintainers[i];
						if (authorName === "") {
							authorName = maintainer.name;
						} else {
							authorName = authorName + ", " + maintainer.name;
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
				licenseURL: licenseURL,
				homepage: homepage,
				author: authorName
			};
		})
		.catch(function(err) {
			if (err.statusCode === 404) {
				err.message = name + " Package doesn't exist";
			}

			throw err;
		});
};
