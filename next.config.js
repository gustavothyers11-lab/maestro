/** @type {import('next').NextConfig} */
const nextConfig = {
	output: undefined,
	experimental: {},
	typescript: {
		ignoreBuildErrors: false,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
};

module.exports = nextConfig;
