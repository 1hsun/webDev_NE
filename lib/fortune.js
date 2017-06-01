var fortunes = [
	"Winter is Coming.",
	"Hear Me Roar.",
	"Fire and Blood.",
	"Our Blades Are Sharp.",
	];
exports.getFortune = function() {
	var idx = Math.floor(Math.random()*fortunes.length);
	return fortunes[idx]
}