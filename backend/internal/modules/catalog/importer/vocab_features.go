package importer

// HymeniumType maps the German hymenium word.
var HymeniumType = map[string]string{
	"lamellen": "gills",
	"roehren":  "tubes",
	"poren":    "pores",
	"stacheln": "spines",
	"leisten":  "folds",
}

// GillAttachment maps the German gill attachment.
var GillAttachment = map[string]string{
	"frei":         "free",
	"angewachsen":  "adnate",
	"ausgebuchtet": "emarginate",
	"herablaufend": "decurrent",
}

// GillSpacing maps the German gill spacing.
var GillSpacing = map[string]string{"eng": "close", "normal": "normal", "weit": "distant"}

// GillEdge maps the German gill edge.
var GillEdge = map[string]string{"glatt": "smooth", "gesaegt": "serrate", "bewimpert": "ciliate"}

// CapShape maps the German cap shape.
var CapShape = map[string]string{
	"halbkugelig":     "hemispherical",
	"gewoelbt":        "convex",
	"flach":           "flat",
	"niedergedrueckt": "depressed",
	"trichterfoermig": "funnel",
	"kegelig":         "conical",
	"glockig":         "bell",
	"eifoermig":       "egg",
	"kugelig":         "spherical",
	"muschelfoermig":  "shell",
	"birnenfoermig":   "pear",
	"keulig":          "club",
	"zylindrisch":     "cylindrical",
}

// CapFeature maps the German cap feature.
var CapFeature = map[string]string{
	"gebuckelt":      "umbonate",
	"hygrophan":      "hygrophanous",
	"gezont":         "zoned",
	"vertieft":       "sunken",
	"unregelmaessig": "irregular",
	"genabelt":       "navelled",
}

// CapMargin maps the German cap margin.
var CapMargin = map[string]string{
	"eingerollt":   "inrolled",
	"wellig":       "wavy",
	"gerieft":      "striate",
	"gerissen":     "cracked",
	"fransig":      "fringed",
	"eingebogen":   "incurved",
	"ueberstehend": "overhanging",
	"scharf":       "sharp",
	"hoeckerig":    "lobed",
}

// StemFeature maps the German stem feature.
var StemFeature = map[string]string{
	"ring":      "ring",
	"knolle":    "bulb",
	"hohl":      "hollow",
	"faserig":   "fibrous",
	"beflockt":  "flocked",
	"voll":      "solid",
	"genattert": "banded",
	"genetzt":   "netted",
	"behaart":   "hairy",
	"wurzelnd":  "rooting",
	"gerieft":   "striate",
	"scheide":   "volva",
	"bruechig":  "brittle",
}

// TraitKey maps the German key of a free trait text.
var TraitKey = map[string]string{
	"fruchtkoerper": "fruitbody",
	"hut":           "cap",
	"roehren":       "tubes",
	"lamellen":      "gills",
	"leisten":       "folds",
	"stacheln":      "spines",
	"poren":         "pores",
	"milch":         "milk",
	"stiel":         "stem",
	"fleisch":       "flesh",
	"geruch":        "smell",
	"geschmack":     "taste",
	"sporenpulver":  "spore_print",
	"reagenzien":    "reagents",
	"vorkommen":     "habitat",
	"zeit":          "season",
	"speisewert":    "edibility",
	"schutz":        "protection",
}

// SmellName gives the German name to show for a smell tag.
var SmellName = map[string]string{
	"angenehm":     "Angenehm",
	"anisartig":    "Anisartig",
	"bittermandel": "Bittermandel",
	"erdartig":     "Erdartig",
	"fischartig":   "Fischartig",
	"fruchtig":     "Fruchtig",
	"gurkenartig":  "Gurkenartig",
	"honigartig":   "Honigartig",
	"karbolartig":  "Karbolartig",
	"maggiartig":   "Maggiartig",
	"mehlig":       "Mehlig",
	"muffig":       "Muffig",
	"obstartig":    "Obstartig",
	"pilzig":       "Pilzig",
	"rettichartig": "Rettichartig",
	"saeuerlich":   "Säuerlich",
	"seifig":       "Seifig",
	"spermatisch":  "Spermatisch",
	"suesslich":    "Süßlich",
	"unangenehm":   "Unangenehm",
	"unauffaellig": "Unauffällig",
	"wuerzig":      "Würzig",
}

// TasteName gives the German name to show for a taste tag.
var TasteName = map[string]string{
	"bitter":     "Bitter",
	"brennend":   "Brennend",
	"herb":       "Herb",
	"kratzend":   "Kratzend",
	"mehlig":     "Mehlig",
	"mild":       "Mild",
	"nussig":     "Nussig",
	"pilzig":     "Pilzig",
	"saeuerlich": "Säuerlich",
	"scharf":     "Scharf",
	"suesslich":  "Süßlich",
	"unangenehm": "Unangenehm",
}

// ReagentSlug maps the German reagent word of a profile to the term slug.
var ReagentSlug = map[string]string{
	"koh":           "koh",
	"naoh":          "naoh",
	"feso4":         "feso4",
	"guajak":        "guaiac",
	"melzer":        "melzer",
	"anilin":        "aniline",
	"phenol":        "phenol",
	"ammoniak":      "ammonia",
	"sulfovanillin": "sulfovanillin",
	"formalin":      "formalin",
	"fecl3":         "fecl3",
	"wieland":       "wieland",
	"schaeffer":     "schaeffer",
}

// ReagentName gives the German name to show for each reagent term slug.
// The last four occur only in daten/reaktionen.json.
var ReagentName = map[string]string{
	"koh":           "Kalilauge (KOH)",
	"naoh":          "Natronlauge (NaOH)",
	"feso4":         "Eisensulfat (FeSO4)",
	"guaiac":        "Guajak",
	"melzer":        "Melzers Reagenz",
	"aniline":       "Anilin",
	"phenol":        "Phenol",
	"ammonia":       "Ammoniak",
	"sulfovanillin": "Sulfovanillin",
	"formalin":      "Formalin",
	"fecl3":         "Eisenchlorid (FeCl3)",
	"wieland":       "Wieland-Reagenz",
	"schaeffer":     "Schäffer-Reaktion",
	"h2so4":         "Schwefelsäure (H2SO4)",
	"meixner":       "Meixner-Test",
	"hno3":          "Salpetersäure (HNO3)",
	"ehrlich":       "Ehrlich-Reagenz",
}

// TreeVocabulary maps the German tree word to its term.
var TreeVocabulary = map[string]Tree{
	"fichte":      {"spruce", "Fichte"},
	"kiefer":      {"pine", "Kiefer"},
	"tanne":       {"fir", "Tanne"},
	"laerche":     {"larch", "Lärche"},
	"douglasie":   {"douglas-fir", "Douglasie"},
	"buche":       {"beech", "Buche"},
	"eiche":       {"oak", "Eiche"},
	"birke":       {"birch", "Birke"},
	"erle":        {"alder", "Erle"},
	"robinie":     {"black-locust", "Robinie"},
	"eibe":        {"yew", "Eibe"},
	"goldregen":   {"laburnum", "Goldregen"},
	"heidelbeere": {"bilberry", "Heidelbeere"},
	"steineiche":  {"holm-oak", "Steineiche"},
	"hainbuche":   {"hornbeam", "Hainbuche"},
	"hasel":       {"hazel", "Hasel"},
	"pappel":      {"poplar", "Pappel"},
	"weide":       {"willow", "Weide"},
	"linde":       {"lime", "Linde"},
	"esche":       {"ash", "Esche"},
	"ulme":        {"elm", "Ulme"},
	"ahorn":       {"maple", "Ahorn"},
	"kastanie":    {"chestnut", "Kastanie"},
	"holunder":    {"elder", "Holunder"},
	"obstbaum":    {"fruit-tree", "Obstbaum"},
}

// TriggerMechanical lists the mechanical triggers in term order.
var TriggerMechanical = []Trigger{
	{"pressure", "Druck"},
	{"cut", "Schnitt"},
	{"bruise", "Druckstelle"},
}

// TriggerEnvironment lists the environment triggers in term order.
var TriggerEnvironment = []Trigger{
	{"heat", "Hitze"},
	{"drought", "Trockenheit"},
	{"frost", "Frost"},
	{"age", "Alter"},
	{"moisture", "Feuchtigkeit"},
}
