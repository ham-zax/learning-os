const team = {
  name: 'core',
  members: ['ana', 'bo'],
  regular() {
    try {
      return this.members.map(function (member) {
        return `${member}@${this.name}`;
      }).join(',');
    } catch (error) {
      return error.constructor.name;
    }
  },
  arrow() {
    return this.members.map((member) => `${member}@${this.name}`).join(',');
  },
};

console.log(team.regular());
console.log(team.arrow());
