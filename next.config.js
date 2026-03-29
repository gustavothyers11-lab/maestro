/** @type {import('next').NextConfig} */
const nextConfig = {
	output: undefined,
	experimental: {
		serverActions: {
			bodySizeLimit: '10mb',
		},
	},
	typescript: {
		ignoreBuildErrors: false,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
};

module.exports = nextConfig;
