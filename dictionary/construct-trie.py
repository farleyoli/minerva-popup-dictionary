import os
import json

root = dict()
c = 0

for filename in os.listdir(os.getcwd()):
    if not 'json' in filename or 'ipa' in filename or 'freq' in filename:
        continue
    with open('./' + filename, 'r') as f:
        dictionary = json.load(f)
        for word in dictionary:
            c += 1
            current = root
            for letter in word:
                current = current.setdefault(letter, {})
            current['_end_'] = '_end_'

with open('trie.json', 'w') as f:
    json.dump(root, f)

print("%d words were added to the trie" % c)