---
title: "How I started the page"
layout: single
author_profile: true
search: false
---

## Code
This set of lines:
```
git clone https://github.com/mmistakes/minimal-mistakes
cd minimal-mistakes

sudo apt update
sudo apt install build-essential ruby-dev
sudo gem install bundler jekyll
#rm -rf Gemfile.lock vendor/bundle
bundle config set --local path 'vendor/bundle'
bundle install
bundle exec jekyll serve
```