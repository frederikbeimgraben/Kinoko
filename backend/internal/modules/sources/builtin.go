package sources

// Limits of the checks of the built-in processors, from the data of 2026.
const (
	treesGridMinRows = 2_000_000
	treesGridMaxRows = 2_600_000
	germanyMinKm2    = 340_000
	germanyMaxKm2    = 370_000
)

// builtinProcessors gives the processors of the kinds that need no raster
// code. The pipeline units register the others with Register.
func builtinProcessors(m *Module) map[Kind]Processor {
	return map[Kind]Processor{
		KindTreesGrid:          treesGrid{minRows: treesGridMinRows, maxRows: treesGridMaxRows},
		KindTreeScales:         treeScales{resolve: m.Resolver()},
		KindSiteGrid:           siteGrid{},
		KindGermanyOutline:     outline{minKm2: germanyMinKm2, maxKm2: germanyMaxKm2},
		KindWeatherCheckpoints: weatherCheckpoints{},
		KindModelBundle:        modelBundles{handle: m.deps.DB},
		KindStaticLayers:       staticLayers{},
	}
}
