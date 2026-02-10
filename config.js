module.exports = {
  tpa_rules: {
    enabled: true,
    patterns: [
      {
        name: 'tpa_en',
        testIncludes: 'wants to teleport to you!',
        regex: /»\s*([A-Za-z0-9_]{3,16})\s+wants to teleport to you!/,
      },
    ],

    commands: { accept: '/tpaccept', deny: '/tpdeny' },
  },
};
